import yf from 'yahoo-finance2';
import NodeCache from 'node-cache';
import type { OhlcvBar } from '../types.js';

// ESM FIX: Получаем рабочий инстанс
const getYahooInstance = () => {
  let instance = yf as any;
  if (instance.default) instance = instance.default;
  if (typeof instance === 'function') {
    try { return new instance(); } catch (e) { return instance; }
  }
  return instance;
};

const yahooFinance = getYahooInstance();

const historyCache = new NodeCache({ stdTTL: 86400 });
const quoteCache = new NodeCache({ stdTTL: 30 });

export async function getHistoricalBars(ticker: string, days = 220): Promise<OhlcvBar[]> {
  const cacheKey = `hist_${ticker}`;
  const cached = historyCache.get<OhlcvBar[]>(cacheKey);
  if (cached) return cached;

  console.log(`[Yahoo] Fetching chart history for ${ticker}`);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    // Используем .chart() вместо .historical()
    // Это именно то, что просит библиотека в твоих логах
    const result = await yahooFinance.chart(ticker, {
      period1: startDate,
      interval: '1d'
    });

    if (!result || !result.quotes || result.quotes.length === 0) {
      console.warn(`[Yahoo] No chart data for ${ticker}`);
      return [];
    }

    // В методе .chart данные лежат в поле .quotes
    const bars: OhlcvBar[] = result.quotes.map((b: any) => ({
      date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : String(b.date),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      avgVolume5d: b.volume || 0,
    })).filter((b: any) => b.close !== null); // Yahoo иногда шлет пустые дни

    historyCache.set(cacheKey, bars);
    console.log(`[Yahoo] Success: ${bars.length} bars for ${ticker}`);
    return bars;
  } catch (error) {
    console.error(`[Yahoo Chart Error] ${ticker}:`, error);
    return [];
  }
}

export async function getLiveQuotes(tickers: string[]): Promise<Record<string, any>> {
  const cacheKey = `quotes_${tickers.join(',')}`;
  const cached = quoteCache.get<Record<string, any>>(cacheKey);
  if (cached) return cached;

  try {
    const results = await yahooFinance.quote(tickers);
    const mapped: Record<string, any> = {};

    const quotesArray = Array.isArray(results) ? results : [results];

    quotesArray.forEach((q: any) => {
      if (q && q.symbol) {
        mapped[q.symbol] = {
          symbol: q.symbol,
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changesPercentage: q.regularMarketChangePercent,
          volume: q.regularMarketVolume,
          avgVolume: q.averageDailyVolume3Month,
        };
      }
    });

    quoteCache.set(cacheKey, mapped);
    return mapped;
  } catch (error) {
    console.error(`[Yahoo Quote Error]:`, error);
    return {};
  }
}

export function clearHistoryCache(ticker: string): void {
  historyCache.del(`hist_${ticker}`);
}