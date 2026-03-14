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
  if (cached) {
    console.log(`[FMP] Cache hit for ${ticker} history`);
    return cached;
  }

  console.log(`[FMP] Fetching history for ${ticker}`);
  const url = `${BASE}/historical-price-full/${ticker}?timeseries=${days}&apikey=${API_KEY}`;
  const res = await fetch(url);
  const json = await res.json() as { historical?: FmpHistoricalBar[] };

  if (!json.historical?.length) {
    console.warn(`[FMP] No history for ${ticker}`);
    return [];
  }

  // FMP returns newest first — reverse to oldest first
  const bars: OhlcvBar[] = json.historical.reverse().map((b) => ({
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
