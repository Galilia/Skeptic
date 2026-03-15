import type { ProcessedStock, TrendDirection, SRLevel, StockIndicators, PatternDetection } from '../types.js';
import type { SkepticsAudit } from '../types.js';
import { computeIndicators } from '../indicators/indicator-engine.js';
import {
  detectWick,
  scanPatterns,
  runAudit,
  computeVerdict,
  computeTrend,
  computeFibLevels,
  computeNearFibLevel,
  computeSupportResistance,
} from '../indicators/analysis.js';
import { getHistoricalBars, getLiveQuotes, getFearGreedIndex, getSectorEtfChange, getAnalystConsensus } from './fmp-provider.js';

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
 * Compute pre-filtered red flags for the audit overlay.
 * All computation stays on the server — frontend only displays.
 */
function computeRedFlags(
  indicators: StockIndicators,
  audit: SkepticsAudit,
  pattern: PatternDetection,
  trendAligned: boolean,
  resistanceLevels: SRLevel[],
  price: number,
  peRatio: number | null,
  analystConsensus: string,
): string[] {
  const flags: string[] = [];

  if (indicators.rsi14 > 70)
    flags.push(`RSI ${indicators.rsi14.toFixed(1)} > 70 — Overbought`);
  if (indicators.rsi14 < 30)
    flags.push(`RSI ${indicators.rsi14.toFixed(1)} < 30 — Oversold (falling knife risk)`);
  if (indicators.smaProximityPct > 12)
    flags.push(`Price +${indicators.smaProximityPct.toFixed(1)}% above SMA50 — Overextended`);
  if (audit.isWeakMomentum)
    flags.push('Volume < 5-day avg — No conviction');
  if (!trendAligned)
    flags.push('Trend NOT aligned — Short vs Long conflict');

  // Warn if nearest resistance is within 2% upside
  if (resistanceLevels.length > 0) {
    const nearest = resistanceLevels[0];
    const upside = (nearest.price - price) / price * 100;
    if (upside <= 2)
      flags.push(`Near strong resistance ($${nearest.price.toFixed(2)}) — Limited upside`);
  }

  if (price < indicators.sma150 && price < indicators.sma200)
    flags.push('Below SMA150 and SMA200 — Bearish structure');
  if (pattern.hasDoubleTop)
    flags.push('Double Top pattern — Distribution signal');
  if (analystConsensus === 'Sell' || analystConsensus === 'Underperform')
    flags.push(`Analyst consensus: ${analystConsensus}`);
  if (peRatio !== null && peRatio > 40)
    flags.push(`P/E ${peRatio.toFixed(1)} > 40 — Expensive valuation`);

  return flags;
}

/**
 * Process a single ticker through the full Skeptic's Engine.
 * Uses cached history + fresh live quote from FMP.
 */
export async function processStock(
  ticker: string,
  liveQuotes?: Record<string, { price: number; change: number; changePercent: number; volume: number; avgVolume: number; trailingPE?: number | null }>,
  fearGreed?: { value: number; label: string }
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
    const wick       = detectWick(enrichedBars);
    const pattern    = scanPatterns(enrichedBars);
    const audit      = runAudit(indicators, volume, avgVolume);

    // Action levels
    const buyTarget = parseFloat((indicators.sma50 * 0.7 + lastBar.low * 0.3).toFixed(2));
    // Dynamic ATR multiplier: wider stop when price is overextended above SMA50
    const stopAtrMultiplier = indicators.smaProximityPct > 5 ? 1.5 : 1.0;
    const stop      = parseFloat((lastBar.low - indicators.atr14 * stopAtrMultiplier).toFixed(2));
    const floor     = pattern.hasDoubleBottom && pattern.patternLevel != null
      ? pattern.patternLevel
      : parseFloat((indicators.sma200 * 0.92).toFixed(2));

    const { type: verdictType, text: verdict } = computeVerdict(
      indicators, audit, wick, pattern, buyTarget, price
    );

    // Signal enrichment
    const shortTrend: TrendDirection = computeTrend(enrichedBars, 20);
    const longTrend:  TrendDirection = computeTrend(enrichedBars, 50);
    const trendAligned  = shortTrend === 'UP' && longTrend === 'UP';
    const volumeConfirmed = avgVolume > 0 && volume >= avgVolume * 1.3;
    const volumeSpike     = avgVolume > 0 && volume >= avgVolume * 2.0;

    const nearBuyTarget = Math.abs(price - buyTarget) / buyTarget * 100 <= 1.5;
    const nearStop      = Math.abs(price - stop) / stop * 100 <= 1.5;

    const priceOnSma150 = Math.abs(price - indicators.sma150) / indicators.sma150 * 100 <= 1.5;
    const priceOnSma200 = Math.abs(price - indicators.sma200) / indicators.sma200 * 100 <= 1.5;

    const fibLevels   = computeFibLevels(enrichedBars, 60);
    const nearFibLevel = computeNearFibLevel(fibLevels, price);
    const { support: supportLevels, resistance: resistanceLevels } =
      computeSupportResistance(enrichedBars, 120);

    // Valuation & sentiment (PE comes from batch quote, F&G cached hourly)
    const peRatio = liveQuotes?.[ticker]?.trailingPE ?? null;
    const resolvedFearGreed = fearGreed ?? await getFearGreedIndex();

    // Sector ETF trend (5-min cache) + analyst consensus (15-min cache)
    const [sectorData, analystData] = await Promise.all([
      getSectorEtfChange(meta?.sector ?? ''),
      getAnalystConsensus(ticker),
    ]);

    // Risk/reward: reward = 2×ATR above entry, risk = buyTarget - stop
    const riskRewardRatio = (buyTarget - stop) > 0
      ? parseFloat(((indicators.atr14 * 2) / (buyTarget - stop)).toFixed(2))
      : 0;

    const redFlags = computeRedFlags(
      indicators, audit, pattern, trendAligned,
      resistanceLevels, price, peRatio, analystData.consensus
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
      peRatio,
      fearGreedValue: resolvedFearGreed.value,
      fearGreedLabel: resolvedFearGreed.label,
      priceOnSma150,
      priceOnSma200,
      volumeConfirmed,
      volumeSpike,
      shortTrend,
      longTrend,
      trendAligned,
      nearBuyTarget,
      nearStop,
      supportLevels,
      resistanceLevels,
      fibLevels,
      nearFibLevel,
      riskRewardRatio,
      sectorChangePercent: sectorData.changePercent,
      sectorTrend: sectorData.trend,
      sectorEtfTicker: sectorData.etfTicker,
      analystConsensus: analystData.consensus,
      analystCount: analystData.count,
      stopAtrMultiplier,
      redFlags,
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
  // Fetch quotes and Fear & Greed in parallel — both are batch/cached operations
  const [rawQuotes, fearGreed] = await Promise.all([
    getLiveQuotes(tickers),
    getFearGreedIndex(),
  ]);

  // Map to simplified format, including trailingPE from the batch quote
  const liveQuotes: Record<string, { price: number; change: number; changePercent: number; volume: number; avgVolume: number; trailingPE?: number | null }> = {};
  Object.entries(rawQuotes).forEach(([ticker, q]) => {
    liveQuotes[ticker] = {
      price: q.price,
      change: q.change,
      changePercent: q.changesPercentage,
      volume: q.volume,
      avgVolume: q.avgVolume,
      trailingPE: q.trailingPE ?? null,
    };
  });

  // Process all tickers in parallel — fear & greed shared, history is cached
  const results = await Promise.all(
    tickers.map((t) => processStock(t, liveQuotes, fearGreed))
  );

  return results.filter((s): s is ProcessedStock => s !== null);
}

export function setNotify(ticker: string, enabled: boolean): void {
  notifyPrefs[ticker.toUpperCase()] = enabled;
}
