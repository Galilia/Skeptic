// ============================================================
// Stock Entity — Core domain types for the Skeptic's Terminal
// ============================================================

export type VerdictType = 'BUY' | 'ACCUMULATE' | 'WAIT' | 'AVOID' | 'DANGER';
export type TrendDirection = 'UP' | 'DOWN' | 'SIDEWAYS';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK';

export interface FibLevel {
  pct: number;
  price: number;
  label: string;
}

export interface WickAnalysis {
  /** Lower wick size in dollars */
  lowerWick: number;
  /** Upper wick size in dollars */
  upperWick: number;
  /** Whether lower wick exceeds 1.5x average body — triggers "Aggressive Entrance" */
  hasAggressiveBuySignal: boolean;
}

export interface SkepticsAudit {
  /** RSI > 70 → overbought warning */
  isOverbought: boolean;
  /** Price > 12% above SMA50 */
  isOverextended: boolean;
  /** Volume < 5-day average */
  isWeakMomentum: boolean;
  /** Human-readable warning list */
  warnings: string[];
}

export interface PatternDetection {
  hasDoubleBottom: boolean;
  hasDoubleTop: boolean;
  patternLevel: number | null;
  patternDescription: string | null;
}

export interface StockQuote {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  avgVolume5d: number;
  change: number;
  changePercent: number;
}

export interface StockIndicators {
  sma20: number;
  sma50: number;
  sma150: number;
  sma200: number;
  rsi14: number;
  atr14: number;
  /** % Distance from SMA50: ((Price - SMA50) / SMA50) * 100 */
  smaProximityPct: number;
}

/**
 * The fully processed stock object broadcast via SignalR.
 * This is the primary data structure for every AG-Grid row.
 */
export interface ProcessedStock {
  ticker: string;
  name: string;
  sector: string;
  strategy: string;
  price: number;
  change: number;
  changePercent: number;

  /** "Action Zone" — where Ptil (wick) and SMA50 intersect */
  buyTarget: number;
  /** Hard stop — swing low minus 1.0 × ATR */
  stop: number;
  /** Absolute structural floor — Double Bottom base */
  floor: number;

  /** Combined RSI + Volume + Trend one-liner */
  verdict: string;
  verdictType: VerdictType;

  /** Whether user wants a price alert when price ≤ buyTarget */
  notifyEnabled: boolean;

  /** Underlying indicators for audit purposes */
  indicators: StockIndicators;
  wick: WickAnalysis;
  audit: SkepticsAudit;
  pattern: PatternDetection;

  /** ISO timestamp of last update */
  lastUpdated: string;

  // Signal enrichment fields
  priceOnSma150: boolean;
  priceOnSma200: boolean;
  volumeConfirmed: boolean;
  volumeSpike: boolean;
  shortTrend: TrendDirection;
  longTrend: TrendDirection;
  trendAligned: boolean;
  nearBuyTarget: boolean;
  nearStop: boolean;
  supportLevels: number[];
  resistanceLevels: number[];
  fibLevels: FibLevel[];
  nearestFibLabel: string | null;
  riskRewardRatio: number;
}

export interface StockFilter {
  sectors: string[];
  strategies: string[];
  verdicts: VerdictType[];
  notifyOnly: boolean;
  nearBuyTargetOnly: boolean;
}

export const DEFAULT_FILTER: StockFilter = {
  sectors: [],
  strategies: [],
  verdicts: [],
  notifyOnly: false,
  nearBuyTargetOnly: false,
};

export const VERDICT_COLORS: Record<VerdictType, string> = {
  BUY: '#00d4aa',
  ACCUMULATE: '#4fc3f7',
  WAIT: '#ffb300',
  AVOID: '#ff7043',
  DANGER: '#e53935',
};

export const VERDICT_BG: Record<VerdictType, string> = {
  BUY: 'rgba(0, 212, 170, 0.15)',
  ACCUMULATE: 'rgba(79, 195, 247, 0.15)',
  WAIT: 'rgba(255, 179, 0, 0.15)',
  AVOID: 'rgba(255, 112, 67, 0.15)',
  DANGER: 'rgba(229, 57, 53, 0.15)',
};
