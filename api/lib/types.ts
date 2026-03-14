export type VerdictType = 'BUY' | 'ACCUMULATE' | 'WAIT' | 'AVOID' | 'DANGER';

export interface StockIndicators {
  sma50: number;
  sma200: number;
  rsi14: number;
  atr14: number;
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
