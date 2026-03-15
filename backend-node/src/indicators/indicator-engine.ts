import type { OhlcvBar, StockIndicators } from '../types.js';

function sma(closes: number[], period: number): number {
  const slice = closes.slice(-period);
  if (slice.length < period) return closes[closes.length - 1] ?? 0;
  return slice.reduce((a, b) => a + b, 0) / period;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
}

function atr(bars: OhlcvBar[], period = 14): number {
  if (bars.length < 2) return 0;
  const trs = bars.slice(1).map((b, i) => Math.max(
    b.high - b.low,
    Math.abs(b.high - bars[i].close),
    Math.abs(b.low - bars[i].close)
  ));
  const slice = trs.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2));
}

export function computeIndicators(bars: OhlcvBar[]): StockIndicators {
  const closes = bars.map((b) => b.close);
  const sma20  = parseFloat(sma(closes, 20).toFixed(2));
  const sma50  = parseFloat(sma(closes, 50).toFixed(2));
  const sma150 = parseFloat(sma(closes, 150).toFixed(2));
  const sma200 = parseFloat(sma(closes, 200).toFixed(2));
  const rsi14  = rsi(closes, 14);
  const atr14  = atr(bars, 14);
  const currentPrice = closes[closes.length - 1];
  const smaProximityPct = parseFloat(
    (((currentPrice - sma50) / sma50) * 100).toFixed(2)
  );
  return { sma20, sma50, sma150, sma200, rsi14, atr14, smaProximityPct };
}
