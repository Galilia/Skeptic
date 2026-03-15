import yf from 'yahoo-finance2';
import NodeCache from 'node-cache';
import type { OhlcvBar, TrendDirection } from '../types.js';

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

// ── Sector ETF Trend ──────────────────────────────────────────────────────────

const SECTOR_ETF: Record<string, string> = {
  'Technology':             'XLK',
  'Financials':             'XLF',
  'Energy':                 'XLE',
  'Consumer Staples':       'XLP',
  'Consumer Discretionary': 'XLY',
  'Industrials':            'XLI',
  'Health Care':            'XLV',
  'Materials':              'XLB',
  'Real Estate':            'XLRE',
  'Utilities':              'XLU',
  'Communication Services': 'XLC',
};

const sectorCache = new NodeCache({ stdTTL: 300 }); // 5-minute cache

export async function getSectorEtfChange(sector: string): Promise<{ changePercent: number; trend: TrendDirection; etfTicker: string }> {
  const etf = SECTOR_ETF[sector];
  if (!etf) return { changePercent: 0, trend: 'SIDEWAYS', etfTicker: '' };

  const cacheKey = `sector_${etf}`;
  const cached = sectorCache.get<{ changePercent: number; trend: TrendDirection; etfTicker: string }>(cacheKey);
  if (cached) return cached;

  try {
    const results = await yahooFinance.quote(etf);
    const q = Array.isArray(results) ? results[0] : results;
    const changePercent = (q as any)?.regularMarketChangePercent ?? 0;
    const trend: TrendDirection = changePercent > 0.3 ? 'UP' : changePercent < -0.3 ? 'DOWN' : 'SIDEWAYS';
    const result = { changePercent: parseFloat(changePercent.toFixed(2)), trend, etfTicker: etf };
    sectorCache.set(cacheKey, result);
    return result;
  } catch {
    return { changePercent: 0, trend: 'SIDEWAYS', etfTicker: etf };
  }
}

// ── Analyst Consensus ─────────────────────────────────────────────────────────

const analystCache = new NodeCache({ stdTTL: 900 }); // 15-minute cache

const RECOMMENDATION_LABELS: Record<string, string> = {
  strongBuy:    'Strong Buy',
  buy:          'Buy',
  hold:         'Hold',
  underperform: 'Underperform',
  sell:         'Sell',
};

export async function getAnalystConsensus(ticker: string): Promise<{ consensus: string; count: number }> {
  const cacheKey = `analyst_${ticker}`;
  const cached = analystCache.get<{ consensus: string; count: number }>(cacheKey);
  if (cached) return cached;

  try {
    const summary = await yahooFinance.quoteSummary(ticker, { modules: ['financialData'] as any });
    const fd = (summary as any).financialData;
    const key   = fd?.recommendationKey ?? '';
    const count = typeof fd?.numberOfAnalystOpinions === 'number' ? fd.numberOfAnalystOpinions : 0;
    const result = {
      consensus: RECOMMENDATION_LABELS[key] ?? (key || 'N/A'),
      count,
    };
    analystCache.set(cacheKey, result);
    return result;
  } catch {
    return { consensus: 'N/A', count: 0 };
  }
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