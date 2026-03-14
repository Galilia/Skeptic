import type {
  OhlcvBar, WickAnalysis, PatternDetection,
  StockIndicators, SkepticsAudit, VerdictType
} from '../types.js';

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
