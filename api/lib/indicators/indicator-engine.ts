import type { OhlcvBar, StockIndicators } from '../types';

/** Simple Moving Average over last N closes */
function sma(closes: number[], period: number): number {
  const slice = closes.slice(-period);
  if (slice.length < period) return closes[closes.length - 1];
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** Wilder's RSI — same formula as Skender library */
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
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
}

/** Average True Range */
function atr(bars: OhlcvBar[], period = 14): number {
  if (bars.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const slice = trs.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2));
}

/** Compute all indicators for a price series */
export function computeIndicators(bars: OhlcvBar[]): StockIndicators {
  const closes = bars.map(b => b.close);
  const sma50val = parseFloat(sma(closes, 50).toFixed(2));
  const sma200val = parseFloat(sma(closes, 200).toFixed(2));
  const rsi14val = rsi(closes, 14);
  const atr14val = atr(bars, 14);
  const currentPrice = closes[closes.length - 1];
  const smaProximityPct = parseFloat(
    (((currentPrice - sma50val) / sma50val) * 100).toFixed(2)
  );
  return { sma50: sma50val, sma200: sma200val, rsi14: rsi14val, atr14: atr14val, smaProximityPct };
}
