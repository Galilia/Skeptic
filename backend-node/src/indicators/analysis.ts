import type {
  OhlcvBar, WickAnalysis, PatternDetection,
  StockIndicators, SkepticsAudit, VerdictType,
  TrendDirection, FibLevel,
} from '../types.js';

// Local SMA helper — avoids circular dependency with indicator-engine
function localSma(closes: number[], period: number): number {
  const slice = closes.slice(-period);
  if (slice.length < period) return closes[closes.length - 1] ?? 0;
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ── Wick / Ptil Detection ─────────────────────────────────────────────────────

export function detectWick(bars: OhlcvBar[]): WickAnalysis {
  if (bars.length < 2) return { lowerWick: 0, upperWick: 0, hasAggressiveBuySignal: false };
  const cur = bars[bars.length - 1];
  const window = bars.slice(-20);
  const bodyBottom = Math.min(cur.open, cur.close);
  const bodyTop = Math.max(cur.open, cur.close);
  const lowerWick = parseFloat((bodyBottom - cur.low).toFixed(2));
  const upperWick = parseFloat((cur.high - bodyTop).toFixed(2));
  const avgBody = window.reduce((s, b) => s + Math.abs(b.close - b.open), 0) / window.length;
  return {
    lowerWick,
    upperWick,
    hasAggressiveBuySignal: avgBody > 0 && lowerWick > avgBody * 1.5,
  };
}

// ── Pattern Scanner ───────────────────────────────────────────────────────────

type Pivot = { index: number; price: number };

function findPivots(bars: OhlcvBar[], isLow: boolean): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = 1; i < bars.length - 1; i++) {
    if (isLow && bars[i].low < bars[i - 1].low && bars[i].low < bars[i + 1].low)
      pivots.push({ index: i, price: bars[i].low });
    if (!isLow && bars[i].high > bars[i - 1].high && bars[i].high > bars[i + 1].high)
      pivots.push({ index: i, price: bars[i].high });
  }
  return pivots;
}

function findMatchingPair(pivots: Pivot[]): number | null {
  for (let i = 0; i < pivots.length - 1; i++) {
    for (let j = i + 1; j < pivots.length; j++) {
      if (pivots[j].index - pivots[i].index < 5) continue;
      const avg = (pivots[i].price + pivots[j].price) / 2;
      if (Math.abs(pivots[i].price - pivots[j].price) / avg < 0.02)
        return parseFloat(avg.toFixed(2));
    }
  }
  return null;
}

export function scanPatterns(bars: OhlcvBar[]): PatternDetection {
  const window = bars.slice(-60);
  if (window.length < 11) return { hasDoubleBottom: false, hasDoubleTop: false, patternLevel: null, patternDescription: null };
  const dbLevel = findMatchingPair(findPivots(window, true));
  if (dbLevel !== null)
    return { hasDoubleBottom: true, hasDoubleTop: false, patternLevel: dbLevel, patternDescription: `Double Bottom at ${dbLevel.toFixed(2)} — confirmed buyers zone` };
  const dtLevel = findMatchingPair(findPivots(window, false));
  if (dtLevel !== null)
    return { hasDoubleBottom: false, hasDoubleTop: true, patternLevel: dtLevel, patternDescription: `Double Top at ${dtLevel.toFixed(2)} — distribution pattern` };
  return { hasDoubleBottom: false, hasDoubleTop: false, patternLevel: null, patternDescription: null };
}

// ── Skeptic's Audit ───────────────────────────────────────────────────────────

export function runAudit(
  indicators: StockIndicators,
  currentVolume: number,
  avgVolume5d: number
): SkepticsAudit {
  const warnings: string[] = [];
  const isOverbought = indicators.rsi14 > 70;
  if (isOverbought) warnings.push(`RSI ${indicators.rsi14.toFixed(1)} > 70 — Overbought`);
  const isOverextended = indicators.smaProximityPct > 12;
  if (isOverextended) warnings.push(`Price +${indicators.smaProximityPct.toFixed(1)}% above SMA50 — Overextended`);
  const isWeakMomentum = avgVolume5d > 0 && currentVolume < avgVolume5d;
  if (isWeakMomentum) warnings.push('Volume < 5-day avg — Weak Momentum');
  if (indicators.smaProximityPct < -5) warnings.push(`Price ${indicators.smaProximityPct.toFixed(1)}% below SMA50 — Bearish trend`);
  return { isOverbought, isOverextended, isWeakMomentum, warnings };
}

// ── Verdict Engine ────────────────────────────────────────────────────────────

export function computeVerdict(
  indicators: StockIndicators,
  audit: SkepticsAudit,
  wick: WickAnalysis,
  pattern: PatternDetection,
  buyTarget: number,
  price: number
): { type: VerdictType; text: string } {
  if (indicators.smaProximityPct < -7 && audit.isWeakMomentum)
    return { type: 'DANGER', text: 'DANGER: Falling knife. Watch the floor.' };
  if (pattern.hasDoubleTop || (indicators.smaProximityPct < -4 && !wick.hasAggressiveBuySignal))
    return { type: 'AVOID', text: 'AVOID: Trend broken. No buyers detected.' };
  if (audit.isOverbought || audit.isOverextended)
    return { type: 'WAIT', text: `WAIT: ${audit.isOverbought ? 'Overbought RSI' : 'Overextended above SMA50'}. High risk.` };
  const distPct = Math.abs((price - buyTarget) / buyTarget * 100);
  if (distPct <= 3 && wick.hasAggressiveBuySignal && !audit.isWeakMomentum)
    return { type: 'BUY', text: `BUY: Near SMA 50. Strong buyers at ${buyTarget.toFixed(2)}.` };
  if (pattern.hasDoubleBottom)
    return { type: 'ACCUMULATE', text: 'ACCUMULATE: Solid Double Bottom support.' };
  if (distPct <= 3 && Math.abs(indicators.smaProximityPct) < 3)
    return { type: 'ACCUMULATE', text: 'ACCUMULATE: Pullback to SMA50. Consider scaling in.' };
  return { type: 'WAIT', text: 'WAIT: No clear signal. Monitor for setup.' };
}

// ── Trend Detection ───────────────────────────────────────────────────────────

/**
 * Compare current SMA[period] vs SMA[period] computed 20 bars ago.
 * Returns UP / DOWN / SIDEWAYS based on ±1.5% change.
 */
export function computeTrend(bars: OhlcvBar[], period: number): TrendDirection {
  const closes = bars.map((b) => b.close);
  if (closes.length < period + 20) return 'SIDEWAYS';
  const currentSma = localSma(closes, period);
  const pastSma = localSma(closes.slice(0, -20), period);
  if (pastSma === 0) return 'SIDEWAYS';
  const changePct = (currentSma - pastSma) / pastSma * 100;
  if (changePct > 1.5) return 'UP';
  if (changePct < -1.5) return 'DOWN';
  return 'SIDEWAYS';
}

// ── Fibonacci Retracement ─────────────────────────────────────────────────────

/**
 * Find the swing high/low in the last `lookback` bars and compute standard
 * Fibonacci retracement levels (23.6 → 78.6%).
 */
export function computeFibLevels(bars: OhlcvBar[], lookback = 60): FibLevel[] {
  const window = bars.slice(-lookback);
  if (window.length < 2) return [];
  let hi = window[0].high;
  let lo = window[0].low;
  for (const b of window) {
    if (b.high > hi) hi = b.high;
    if (b.low  < lo) lo = b.low;
  }
  const range = hi - lo;
  if (range === 0) return [];
  return [
    { pct: 23.6, label: '23.6%', price: parseFloat((hi - range * 0.236).toFixed(2)) },
    { pct: 38.2, label: '38.2%', price: parseFloat((hi - range * 0.382).toFixed(2)) },
    { pct: 50.0, label: '50%',   price: parseFloat((hi - range * 0.500).toFixed(2)) },
    { pct: 61.8, label: '61.8%', price: parseFloat((hi - range * 0.618).toFixed(2)) },
    { pct: 78.6, label: '78.6%', price: parseFloat((hi - range * 0.786).toFixed(2)) },
  ];
}

/**
 * Return the label of the Fibonacci level nearest to `currentPrice`,
 * or null if the nearest is more than 2% away.
 */
export function findNearestFibLabel(fibLevels: FibLevel[], currentPrice: number): string | null {
  if (fibLevels.length === 0) return null;
  let nearest = fibLevels[0];
  let minDist = Math.abs(currentPrice - fibLevels[0].price);
  for (const f of fibLevels) {
    const d = Math.abs(currentPrice - f.price);
    if (d < minDist) { minDist = d; nearest = f; }
  }
  if (minDist / currentPrice * 100 > 2) return null;
  return nearest.label;
}

// ── Support / Resistance ──────────────────────────────────────────────────────

/**
 * Bucket OHLC prices into 1%-wide buckets over the last `lookback` bars.
 * Buckets touched ≥3 times are treated as S/R levels.
 * Returns the top 3 support levels (below price) and top 3 resistance levels (above).
 */
export function computeSupportResistance(
  bars: OhlcvBar[],
  lookback = 120
): { support: number[]; resistance: number[] } {
  const window = bars.slice(-lookback);
  if (window.length < 2) return { support: [], resistance: [] };
  const currentPrice = window[window.length - 1].close;
  const bucketSize = currentPrice * 0.01;
  const buckets = new Map<number, number>();
  for (const b of window) {
    for (const p of [b.high, b.low, b.close]) {
      const key = Math.round(p / bucketSize);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  const levels: number[] = [];
  buckets.forEach((count, key) => {
    if (count >= 3) levels.push(parseFloat((key * bucketSize).toFixed(2)));
  });
  levels.sort((a, b) => a - b);
  return {
    support:    levels.filter((p) => p < currentPrice).slice(-3),
    resistance: levels.filter((p) => p > currentPrice).slice(0, 3),
  };
}
