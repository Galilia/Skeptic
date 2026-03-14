import type { OhlcvBar, WickAnalysis } from '../types';

const LOOKBACK = 20;

/** Ptil wick logic: fires when lowerWick > avgBody * 1.5 */
export function detectWick(bars: OhlcvBar[]): WickAnalysis {
  if (bars.length < 2) return { lowerWick: 0, upperWick: 0, hasAggressiveBuySignal: false };

  const current = bars[bars.length - 1];
  const window = bars.slice(-LOOKBACK);

  const bodyBottom = Math.min(current.open, current.close);
  const bodyTop = Math.max(current.open, current.close);
  const lowerWick = parseFloat((bodyBottom - current.low).toFixed(2));
  const upperWick = parseFloat((current.high - bodyTop).toFixed(2));

  const avgBody = window.reduce((sum, b) => sum + Math.abs(b.close - b.open), 0) / window.length;
  const hasAggressiveBuySignal = avgBody > 0 && lowerWick > avgBody * 1.5;

  return { lowerWick, upperWick, hasAggressiveBuySignal };
}
