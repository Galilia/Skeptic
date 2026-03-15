export type VerdictType = 'BUY' | 'ACCUMULATE' | 'WAIT' | 'AVOID' | 'DANGER';
export type TrendDirection = 'UP' | 'DOWN' | 'SIDEWAYS';

export interface FibLevel {
  pct: number;
  price: number;
  label: string;
}

export interface OhlcvBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  avgVolume5d: number;
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

export interface WickAnalysis {
  lowerWick: number;
  upperWick: number;
  hasAggressiveBuySignal: boolean;
}

export interface SkepticsAudit {
  isOverbought: boolean;
  isOverextended: boolean;
  isWeakMomentum: boolean;
  warnings: string[];
}

export interface PatternDetection {
  hasDoubleBottom: boolean;
  hasDoubleTop: boolean;
  patternLevel: number | null;
  patternDescription: string | null;
}

export interface ProcessedStock {
  ticker: string;
  name: string;
  sector: string;
  strategy: string;
  price: number;
  change: number;
  changePercent: number;
  buyTarget: number;
  stop: number;
  floor: number;
  verdict: string;
  verdictType: VerdictType;
  notifyEnabled: boolean;
  indicators: StockIndicators;
  wick: WickAnalysis;
  audit: SkepticsAudit;
  pattern: PatternDetection;
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
