import yahooFinance from 'yahoo-finance2';
import type { OhlcvBar } from '../types.js';

// yahoo-finance2 overload resolution is unreliable with the bundler moduleResolution,
// so both calls are cast to `any` and shaped locally.

interface YahooBar {
  date:    Date;
  open:    number;
  high:    number;
  low:     number;
  close:   number;
  volume?: number;
}

interface YahooQuote {
  symbol?:             string;
  regularMarketPrice?: number;
  ask?:                number;
  bid?:                number;
}

/**
 * Fetch OHLCV history for a ticker from Yahoo Finance.
 * Returns bars sorted oldest → newest.
 */
export async function getHistoricalBars(ticker: string, days: number): Promise<OhlcvBar[]> {
  const period2 = new Date();
  const period1 = new Date(period2.getTime() - days * 86_400_000);

  const rows = await (yahooFinance.historical as any)(ticker, {
    period1:  period1.toISOString().slice(0, 10),
    period2:  period2.toISOString().slice(0, 10),
    interval: '1d',
  }) as YahooBar[];

  if (!rows.length) return [];

  // Compute 5-day rolling average volume
  const bars: OhlcvBar[] = rows.map((row, i) => {
    const slice = rows.slice(Math.max(0, i - 4), i + 1);
    const avgVolume5d = Math.round(
      slice.reduce((sum, r) => sum + (r.volume ?? 0), 0) / slice.length
    );
    return {
      date:       row.date.toISOString().slice(0, 10),
      open:       row.open  ?? row.close,
      high:       row.high  ?? row.close,
      low:        row.low   ?? row.close,
      close:      row.close,
      volume:     row.volume ?? 0,
      avgVolume5d,
    };
  });

  return bars;
}

/**
 * Fetch current prices for multiple tickers in a single request.
 * Returns a map of ticker → current price.
 */
export async function getLiveQuotes(tickers: string[]): Promise<Record<string, number>> {
  if (!tickers.length) return {};

  const quotes = await (yahooFinance.quote as any)(tickers) as YahooQuote[];

  const map: Record<string, number> = {};
  for (const q of quotes) {
    const price = q.regularMarketPrice ?? q.ask ?? q.bid;
    if (q.symbol && price != null) {
      map[q.symbol.toUpperCase()] = price;
    }
  }
  return map;
}
