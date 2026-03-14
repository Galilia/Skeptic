import NodeCache from 'node-cache';
import type { OhlcvBar } from '../types.js';

const API_KEY = process.env.FMP_API_KEY ?? '';
const BASE = 'https://financialmodelingprep.com/api/v3';

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
export async function getHistoricalBars(
  ticker: string,
  days = 220
): Promise<OhlcvBar[]> {
  const cacheKey = `hist_${ticker}`;
  const cached = historyCache.get<OhlcvBar[]>(cacheKey);
  if (cached) return cached;

  console.log(`[FMP] Fetching history for ${ticker} via Chart API`);

  const url = `${BASE}/historical-chart/1day/${ticker}?apikey=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    const json = await res.json() as any;

  
    if (json["Error Message"]) {
      console.error(`[FMP ERROR] ${ticker}: ${json["Error Message"]}`);
      return [];
    }

    if (!Array.isArray(json) || json.length === 0) {
      console.warn(`[FMP] No chart data for ${ticker}. Response:`, JSON.stringify(json).slice(0, 100));
      return [];
    }

    const bars: OhlcvBar[] = json.slice(0, days).reverse().map((b: any) => ({
      date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      avgVolume5d: b.volume,
    }));

    console.log(`[FMP] Successfully parsed ${bars.length} bars for ${ticker}`);
    historyCache.set(cacheKey, bars);
    return bars;
  } catch (error) {
    console.error(`[FMP FETCH ERROR] ${ticker}:`, error);
    return [];
  }
}

/**
 * Fetch live quotes for all tickers in a single batch request.
 * Cached for 1 minute — this is the "live" price update.
 */
export async function getLiveQuotes(
  tickers: string[]
): Promise<Record<string, FmpQuote>> {
  const cacheKey = `quotes_${tickers.join(',')}`;
  const cached = quoteCache.get<Record<string, FmpQuote>>(cacheKey);
  if (cached) return cached;

  console.log(`[FMP] Fetching live quotes for ${tickers.length} tickers`);
  const url = `${BASE}/quote/${tickers.join(',')}?apikey=${API_KEY}`;
  const res = await fetch(url);
  const quotes = await res.json() as FmpQuote[];

  const result: Record<string, FmpQuote> = {};
  if (Array.isArray(quotes)) {
    quotes.forEach((q) => { result[q.symbol] = q; });
  }

  quoteCache.set(cacheKey, result);
  return result;
}

/** Clear history cache for a specific ticker (force refresh) */
export function clearHistoryCache(ticker: string): void {
  historyCache.del(`hist_${ticker}`);
}
