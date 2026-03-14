import type { OhlcvBar } from '../types';

const API_KEY = process.env.FMP_API_KEY ?? '';
const BASE = 'https://financialmodelingprep.com/api/v3';

interface FmpQuote {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  previousClose: number;
}

interface FmpHistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getLiveQuotes(
  tickers: string[]
): Promise<Record<string, number>> {
  if (!tickers.length) return {};
  const url = `${BASE}/quote/${tickers.join(',')}?apikey=${API_KEY}`;
  console.log('[FMP] fetching live quotes for', tickers.length, 'tickers');
  const res = await fetch(url);
  const json = await res.json() as FmpQuote[];
  const result: Record<string, number> = {};
  (Array.isArray(json) ? json : []).forEach((q) => {
    if (q.symbol && q.price != null) {
      result[q.symbol.toUpperCase()] = q.price;
    }
  });
  return result;
}

export async function getHistoricalBars(
  ticker: string,
  days: number
): Promise<OhlcvBar[]> {
  const url = `${BASE}/historical-price-full/${ticker}?timeseries=${days}&apikey=${API_KEY}`;
  console.log('[FMP] fetching bars for', ticker);
  const res = await fetch(url);
  const json = await res.json() as { historical?: FmpHistoricalBar[] };
  const rows = json.historical ?? [];
  // FMP returns newest-first — reverse to oldest-first
  return rows.slice().reverse().map((r) => ({
    date:       r.date,
    open:       r.open,
    high:       r.high,
    low:        r.low,
    close:      r.close,
    volume:     r.volume,
    avgVolume5d: r.volume,
  }));
}
