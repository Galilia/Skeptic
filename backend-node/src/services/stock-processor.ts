import type { ProcessedStock } from '../types.js';
import { computeIndicators } from '../indicators/indicator-engine.js';
import { detectWick, scanPatterns, runAudit, computeVerdict } from '../indicators/analysis.js';
import { getHistoricalBars, getLiveQuotes } from './fmp-provider.js';

/** Metadata for default portfolio */
export const PORTFOLIO_META: Record<string, { name: string; sector: string; strategy: string }> = {
  ADM:   { name: 'Archer-Daniels-Midland', sector: 'Consumer Staples',       strategy: 'Value'    },
  NVDA:  { name: 'NVIDIA Corporation',      sector: 'Technology',             strategy: 'Momentum' },
  GE:    { name: 'GE Aerospace',            sector: 'Industrials',            strategy: 'Growth'   },
  GOOGL: { name: 'Alphabet Inc.',           sector: 'Technology',             strategy: 'Growth'   },
  INTC:  { name: 'Intel Corporation',       sector: 'Technology',             strategy: 'Value'    },
  MSFT:  { name: 'Microsoft Corporation',   sector: 'Technology',             strategy: 'Growth'   },
  JPM:   { name: 'JPMorgan Chase',          sector: 'Financials',             strategy: 'Dividend' },
  XOM:   { name: 'Exxon Mobil',             sector: 'Energy',                 strategy: 'Dividend' },
  TSLA:  { name: 'Tesla Inc.',              sector: 'Consumer Discretionary', strategy: 'Momentum' },
  META:  { name: 'Meta Platforms',          sector: 'Technology',             strategy: 'Growth'   },
};

const notifyPrefs: Record<string, boolean> = {};

/**
 * Process a single ticker through the full Skeptic's Engine.
 * Uses cached history + fresh live quote from FMP.
 */
export async function processStock(
  ticker: string,
  liveQuotes?: Record<string, { price: number; change: number; changePercent: number; volume: number; avgVolume: number }>
): Promise<ProcessedStock | null> {
  try {
    const meta = PORTFOLIO_META[ticker.toUpperCase()];
    const bars = await getHistoricalBars(ticker, 220);

    if (bars.length < 50) {
      console.warn(`[processStock] Not enough bars for ${ticker}: ${bars.length}`);
      return null;
    }

    // Use live quote if available, otherwise use last bar
    const live = liveQuotes?.[ticker];
    const lastBar = bars[bars.length - 1];
    const price = live?.price ?? lastBar.close;
    const change = live?.change ?? 0;
    const changePercent = live?.changePercent ?? 0;
    const volume = live?.volume ?? lastBar.volume;
    const avgVolume = live?.avgVolume ?? lastBar.avgVolume5d;

    // Update last bar with live price for indicator accuracy
    const enrichedBars = [...bars.slice(0, -1), { ...lastBar, close: price }];

    const indicators = computeIndicators(enrichedBars);
    const wick = detectWick(enrichedBars);
    const pattern = scanPatterns(enrichedBars);
    const audit = runAudit(indicators, volume, avgVolume);

    // Action levels
    const buyTarget = parseFloat((indicators.sma50 * 0.7 + lastBar.low * 0.3).toFixed(2));
    const stop = parseFloat((lastBar.low - indicators.atr14).toFixed(2));
    const floor = pattern.hasDoubleBottom && pattern.patternLevel != null
      ? pattern.patternLevel
      : parseFloat((indicators.sma200 * 0.92).toFixed(2));

    const { type: verdictType, text: verdict } = computeVerdict(
      indicators, audit, wick, pattern, buyTarget, price
    );

    console.log(`[processStock] ${ticker} price=${price} rsi=${indicators.rsi14} verdict=${verdictType}`);

    return {
      ticker: ticker.toUpperCase(),
      name: meta?.name ?? ticker,
      sector: meta?.sector ?? 'Unknown',
      strategy: meta?.strategy ?? 'Unknown',
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      buyTarget,
      stop,
      floor,
      verdict,
      verdictType,
      notifyEnabled: notifyPrefs[ticker] ?? false,
      indicators,
      wick,
      audit,
      pattern,
      lastUpdated: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`[processStock] Error for ${ticker}:`, e);
    return null;
  }
}

/**
 * Process all tickers in portfolio using a single batch live quote request.
 * This is the main function called every minute.
 */
export async function processBatch(tickers: string[]): Promise<ProcessedStock[]> {
  // Single batch request for all live quotes
  const rawQuotes = await getLiveQuotes(tickers);

  // Map to simplified format
  const liveQuotes: Record<string, { price: number; change: number; changePercent: number; volume: number; avgVolume: number }> = {};
  Object.entries(rawQuotes).forEach(([ticker, q]) => {
    liveQuotes[ticker] = {
      price: q.price,
      change: q.change,
      changePercent: q.changesPercentage,
      volume: q.volume,
      avgVolume: q.avgVolume,
    };
  });

  // Process all tickers in parallel (history is cached)
  const results = await Promise.all(
    tickers.map((t) => processStock(t, liveQuotes))
  );

  return results.filter((s): s is ProcessedStock => s !== null);
}

export function setNotify(ticker: string, enabled: boolean): void {
  notifyPrefs[ticker.toUpperCase()] = enabled;
}
