import yf from 'yahoo-finance2';
import NodeCache from 'node-cache';
import type { OhlcvBar } from '../types.js';

// --- ESM FIX: Гарантируем получение рабочего инстанса ---
const getYahooInstance = () => {
  // 1. Пробуем дефолтный импорт
  let instance = yf as any;
  
  // 2. Если это обертка ESM, берем .default
  if (instance.default) instance = instance.default;

  // 3. Если это Класс (а не инстанс), создаем новый объект
  // Именно это фиксит ошибку "Call const yahooFinance = new YahooFinance() first"
  if (typeof instance === 'function') {
    try {
      return new instance();
    } catch (e) {
      return instance;
    }
  }
  return instance;
};

const yahooFinance = getYahooInstance();
// -------------------------------------------------------

const historyCache = new NodeCache({ stdTTL: 86400 });
const quoteCache = new NodeCache({ stdTTL: 30 });

export async function getHistoricalBars(ticker: string, days = 220): Promise<OhlcvBar[]> {
  const cacheKey = `hist_${ticker}`;
  const cached = historyCache.get<OhlcvBar[]>(cacheKey);
  if (cached) return cached;

  console.log(`[Yahoo] Fetching history for ${ticker}`);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const result = await yahooFinance.historical(ticker, {
      period1: startDate,
      interval: '1d'
    });

    if (!result || result.length === 0) {
      console.warn(`[Yahoo] No data for ${ticker}`);
      return [];
    }

    const bars: OhlcvBar[] = result.map((b: any) => ({
      date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : String(b.date),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      avgVolume5d: b.volume,
    }));

    historyCache.set(cacheKey, bars);
    return bars;
  } catch (error) {
    console.error(`[Yahoo History Error] ${ticker}:`, error);
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

    if (Array.isArray(results)) {
      results.forEach((q: any) => {
        mapped[q.symbol] = {
          symbol: q.symbol,
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changesPercentage: q.regularMarketChangePercent,
          volume: q.regularMarketVolume,
          avgVolume: q.averageDailyVolume3Month,
        };
      });
    }

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

export function clearQuoteCache(tickers: string[]): void {
  quoteCache.del(`quotes_${tickers.join(',')}`);
}