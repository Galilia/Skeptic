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
          trailingPE: typeof q.trailingPE === 'number' ? q.trailingPE : null,
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

// ── Fear & Greed Index ────────────────────────────────────────────────────────

const fngCache = new NodeCache({ stdTTL: 3600 }); // refresh once per hour

/**
 * Fetch the Crypto Fear & Greed Index from alternative.me.
 * Returns a cached result for up to 1 hour.
 */
export async function getFearGreedIndex(): Promise<{ value: number; label: string }> {
  const cached = fngCache.get<{ value: number; label: string }>('fear_greed');
  if (cached) return cached;

  try {
    const res  = await fetch('https://api.alternative.me/fng/');
    const json = await res.json() as { data: Array<{ value: string; value_classification: string }> };
    const item = json.data?.[0];
    const result = {
      value: parseInt(item?.value ?? '50', 10),
      label: item?.value_classification ?? 'Neutral',
    };
    fngCache.set('fear_greed', result);
    return result;
  } catch {
    // Return neutral on network failure — non-critical data
    return { value: 50, label: 'Neutral' };
  }
}