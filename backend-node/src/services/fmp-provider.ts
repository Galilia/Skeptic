import NodeCache from 'node-cache';
import type { OhlcvBar } from '../types.js';

const API_KEY = process.env.FMP_API_KEY ?? '';
const BASE = 'https://financialmodelingprep.com/stable';

/** Cache historical bars for 24 hours, live quotes for 1 minute */
const historyCache = new NodeCache({ stdTTL: 86400 });
const quoteCache = new NodeCache({ stdTTL: 60 });

interface FmpHistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FmpQuote {
  symbol: string;
  name: string;
  price: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  avgVolume: number;
  change: number;
  changesPercentage: number;
  previousClose: number;
}

interface FmpHistoricalResponse {
  historical?: FmpHistoricalBar[];
  "Error Message"?: string; 
}

/**
 * Fetch historical OHLCV bars for a single ticker.
 * Cached for 24 hours — only refreshes once per day.
 */
export async function getHistoricalBars(ticker: string, days = 220): Promise<OhlcvBar[]> {
  const cacheKey = `hist_${ticker}`;
  const cached = historyCache.get<OhlcvBar[]>(cacheKey);
  if (cached) return cached;

  const url = `${BASE}/historical-price-eod/full?symbol=${ticker}&apikey=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    const json = await res.json() as any;

    if (json["Error Message"]) {
      console.error(`[FMP ERROR] ${ticker}: ${json["Error Message"]}`);
      return [];
    }

    const data = Array.isArray(json) ? json : json.historical;

    if (!data || data.length === 0) {
      console.warn(`[FMP] No stable data for ${ticker}`);
      return [];
    }

    const bars: OhlcvBar[] = data.slice(0, days).reverse().map((b: any) => ({
      date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      avgVolume5d: b.volume,
    }));

    historyCache.set(cacheKey, bars);
    return bars;
  } catch (e) {
    console.error(`[FMP Stable Error] ${ticker}:`, e);
    return [];
  }
}
/**
 * Fetch live quotes for all tickers in a single batch request.
 * Cached for 1 minute — this is the "live" price update.
 */
export async function getLiveQuotes(tickers: string[]): Promise<Record<string, any>> {
  const url = `${BASE}/quote?symbol=${tickers.join(',')}&apikey=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    const quotes = await res.json() as any[];
    
    const result: Record<string, any> = {};
    if (Array.isArray(quotes)) {
      quotes.forEach((q) => {
        result[q.symbol] = {
          symbol: q.symbol,
          price: q.price,
          change: q.change,
          changesPercentage: q.changesPercentage,
          volume: q.volume,
          avgVolume: q.avgVolume,
        };
      });
    }
    return result;
  } catch (e) {
    console.error(`[FMP Stable Quote Error]:`, e);
    return {};
  }
}
/** Clear history cache for a specific ticker (force refresh) */
export function clearHistoryCache(ticker: string): void {
  historyCache.del(`hist_${ticker}`);
}
