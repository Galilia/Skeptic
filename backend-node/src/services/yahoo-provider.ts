import { default as yahooFinance } from 'yahoo-finance2';
import type { OhlcvBar } from '../types.js';

export async function getHistoricalBars(
  ticker: string,
  days: number
): Promise<OhlcvBar[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const rows = await yahooFinance.historical(ticker, {
    period1: start.toISOString().slice(0, 10),
    period2: end.toISOString().slice(0, 10),
    interval: '1d',
  });

  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    open: r.open ?? r.close,
    high: r.high ?? r.close,
    low: r.low ?? r.close,
    close: r.close,
    volume: r.volume ?? 0,
    avgVolume5d: r.volume ?? 0,
  }));
}

export async function getLiveQuotes(
  tickers: string[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const quotes = await yahooFinance.quote(tickers);
  const arr = Array.isArray(quotes) ? quotes : [quotes];
  arr.forEach((q) => {
    if (q?.symbol && q?.regularMarketPrice) {
      result[q.symbol] = q.regularMarketPrice;
    }
  });
  return result;
}
