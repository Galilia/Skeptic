import type { OhlcvBar, PatternDetection } from '../types.js';

const SCAN_DAYS = 60;
const VARIANCE = 0.02;
const MIN_GAP = 5;

type Pivot = { index: number; price: number };

function findPivots(bars: OhlcvBar[], isLow: boolean): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = 1; i < bars.length - 1; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];
    const next = bars[i + 1];
    if (isLow && curr.low < prev.low && curr.low < next.low)
      pivots.push({ index: i, price: curr.low });
    if (!isLow && curr.high > prev.high && curr.high > next.high)
      pivots.push({ index: i, price: curr.high });
  }
  return pivots;
}

function findMatchingPair(pivots: Pivot[]): number | null {
  for (let i = 0; i < pivots.length - 1; i++) {
    for (let j = i + 1; j < pivots.length; j++) {
      if (pivots[j].index - pivots[i].index < MIN_GAP) continue;
      const avg = (pivots[i].price + pivots[j].price) / 2;
      if (avg === 0) continue;
      const variance = Math.abs(pivots[i].price - pivots[j].price) / avg;
      if (variance < VARIANCE) return parseFloat(avg.toFixed(2));
    }
  }
  return null;
}

export function scanPatterns(bars: OhlcvBar[]): PatternDetection {
  const window = bars.slice(-SCAN_DAYS);
  if (window.length < MIN_GAP * 2 + 1)
    return { hasDoubleBottom: false, hasDoubleTop: false, patternLevel: null, patternDescription: null };

  const lows = findPivots(window, true);
  const dbLevel = findMatchingPair(lows);
  if (dbLevel !== null)
    return { hasDoubleBottom: true, hasDoubleTop: false, patternLevel: dbLevel, patternDescription: `Double Bottom at ${dbLevel.toFixed(2)} — confirmed buyers zone` };

  const highs = findPivots(window, false);
  const dtLevel = findMatchingPair(highs);
  if (dtLevel !== null)
    return { hasDoubleBottom: false, hasDoubleTop: true, patternLevel: dtLevel, patternDescription: `Double Top at ${dtLevel.toFixed(2)} — distribution pattern` };

  return { hasDoubleBottom: false, hasDoubleTop: false, patternLevel: null, patternDescription: null };
}
