import type { StockIndicators, WickAnalysis, PatternDetection, SkepticsAudit, VerdictType } from '../types.js';

/** Reasons NOT to buy */
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

/** BUY / ACCUMULATE / WAIT / AVOID / DANGER */
export function computeVerdict(
  indicators: StockIndicators,
  audit: SkepticsAudit,
  wick: WickAnalysis,
  pattern: PatternDetection,
  buyTarget: number,
  currentPrice: number
): { type: VerdictType; text: string } {
  if (indicators.smaProximityPct < -7 && audit.isWeakMomentum)
    return { type: 'DANGER', text: 'DANGER: Falling knife. Watch the floor.' };

  if (pattern.hasDoubleTop || (indicators.smaProximityPct < -4 && !wick.hasAggressiveBuySignal))
    return { type: 'AVOID', text: 'AVOID: Trend broken. No buyers detected.' };

  if (audit.isOverbought || audit.isOverextended) {
    const reason = audit.isOverbought ? 'Overbought RSI.' : 'Overextended above SMA50.';
    return { type: 'WAIT', text: `WAIT: ${reason} High risk.` };
  }

  const distPct = Math.abs((currentPrice - buyTarget) / buyTarget * 100);
  if (distPct <= 3 && wick.hasAggressiveBuySignal && !audit.isWeakMomentum)
    return { type: 'BUY', text: `BUY: Near SMA 50. Strong buyers at ${buyTarget.toFixed(2)}.` };

  if (pattern.hasDoubleBottom)
    return { type: 'ACCUMULATE', text: 'ACCUMULATE: Solid Double Bottom support.' };

  if (distPct <= 3 && Math.abs(indicators.smaProximityPct) < 3)
    return { type: 'ACCUMULATE', text: 'ACCUMULATE: Pullback to SMA50. Consider scaling in.' };

  return { type: 'WAIT', text: 'WAIT: No clear signal. Monitor for setup.' };
}
