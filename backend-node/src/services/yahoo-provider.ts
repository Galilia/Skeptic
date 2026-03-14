import type { OhlcvBar } from '../types.js';

const API_KEY = process.env.POLYGON_API_KEY ?? '';
const BASE = 'https://api.polygon.io';

interface PolygonBar {
  t: number; o: number; h: number; l: number; c: number; v: number;
}

interface PolygonSnapshot {
  ticker: string;
  day?: { c: number };
  prevDay?: { c: number };
}

export async function getHistoricalBars(
  ticker: string,
  days: number
): Promise<OhlcvBar[]> {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const url = `${BASE}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=300&apiKey=${API_KEY}`;
  console.log('[Polygon] fetching bars for', ticker);
  const res = await fetch(url);
  const json = await res.json() as { results?: PolygonBar[]; status?: string; error?: string };
  console.log('[Polygon] response status:', json.status, 'bars:', json.results?.length ?? 0, 'error:', json.error);
  return (json.results ?? []).map((r) => ({
    date: new Date(r.t).toISOString().slice(0, 10),
    open: r.o, high: r.h, low: r.l, close: r.c,
    volume: r.v, avgVolume5d: r.v,
  }));
}

export async function getLiveQuotes(
  tickers: string[]
): Promise<Record<string, number>> {
  const list = tickers.join(',');
  const url = `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${list}&apiKey=${API_KEY}`;
  console.log('[Polygon] fetching live quotes for', tickers.length, 'tickers');
  const res = await fetch(url);
  const json = await res.json() as { tickers?: PolygonSnapshot[] };
  const result: Record<string, number> = {};
  (json.tickers ?? []).forEach((t) => {
    result[t.ticker] = t.day?.c ?? t.prevDay?.c ?? 0;
  });
  return result;
}
