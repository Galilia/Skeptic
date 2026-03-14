import type { OhlcvBar, ProcessedStock } from '../types.js';
import { computeIndicators } from '../indicators/indicator-engine.js';
import { detectWick } from '../indicators/wick-detector.js';
import { scanPatterns } from '../patterns/pattern-scanner.js';
import { runAudit, computeVerdict } from '../audit/skeptic-auditor.js';

const METADATA: Record<string, { name: string; sector: string; strategy: string; basePrice: number }> = {
  ADM:   { name: 'Archer-Daniels-Midland', sector: 'Consumer Staples',       strategy: 'Value',    basePrice: 71.80  },
  NVDA:  { name: 'NVIDIA Corporation',      sector: 'Technology',             strategy: 'Momentum', basePrice: 183.04 },
  GE:    { name: 'GE Aerospace',            sector: 'Industrials',            strategy: 'Growth',   basePrice: 304.72 },
  GOOGL: { name: 'Alphabet Inc.',           sector: 'Technology',             strategy: 'Growth',   basePrice: 303.73 },
  INTC:  { name: 'Intel Corporation',       sector: 'Technology',             strategy: 'Value',    basePrice: 45.52  },
  MSFT:  { name: 'Microsoft Corporation',   sector: 'Technology',             strategy: 'Growth',   basePrice: 415.30 },
  JPM:   { name: 'JPMorgan Chase',          sector: 'Financials',             strategy: 'Dividend', basePrice: 218.45 },
  XOM:   { name: 'Exxon Mobil',             sector: 'Energy',                 strategy: 'Dividend', basePrice: 108.20 },
  TSLA:  { name: 'Tesla Inc.',              sector: 'Consumer Discretionary', strategy: 'Momentum', basePrice: 242.80 },
  META:  { name: 'Meta Platforms',          sector: 'Technology',             strategy: 'Growth',   basePrice: 558.90 },
};

/** Generate synthetic OHLCV history */
function generateBars(basePrice: number, days: number): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = basePrice * 0.88;
  const seed = Math.floor(basePrice);
  for (let i = days - 1; i >= 0; i--) {
    const noise = (Math.sin(seed * i) * 0.5 + 0.5) * 0.04 - 0.018;
    const open = price;
    const close = parseFloat((price * (1 + noise)).toFixed(2));
    const high = parseFloat((Math.max(open, close) * (1 + Math.abs(Math.cos(i)) * 0.008)).toFixed(2));
    const low  = parseFloat((Math.min(open, close) * (1 - Math.abs(Math.sin(i)) * 0.008)).toFixed(2));
    const volume = 10_000_000 + Math.floor(Math.abs(Math.sin(seed + i)) * 15_000_000);
    bars.push({ date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), open, high, low, close, volume, avgVolume5d: volume });
    price = close;
  }
  return bars;
}

function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 9:30 ET = 14:30 UTC, 16:00 ET = 21:00 UTC
  return totalMinutes >= 870 && totalMinutes <= 1260;
}

/** Add live price jitter */
function jitter(price: number, volatility = 0.003): number {
  return parseFloat((price * (1 + (Math.random() - 0.5) * 2 * volatility)).toFixed(2));
}

const notifyPrefs: Record<string, boolean> = {};

/** Full Skeptic's Engine pipeline for one ticker */
export function processStock(ticker: string): ProcessedStock | null {
  const meta = METADATA[ticker.toUpperCase()];
  if (!meta) return null;

  const bars = generateBars(meta.basePrice, 220);

  // Apply live jitter to last bar only during market hours
  const last = bars[bars.length - 1];
  if (isMarketOpen()) {
    last.close = jitter(last.close);
  }

  const indicators = computeIndicators(bars);
  const wick       = detectWick(bars);
  const pattern    = scanPatterns(bars);
  const audit      = runAudit(indicators, last.volume, last.avgVolume5d);

  // Action levels
  const buyTarget = parseFloat((indicators.sma50 * 0.7 + last.low * 0.3).toFixed(2));
  const stop      = parseFloat((last.low - indicators.atr14).toFixed(2));
  const floor     = pattern.hasDoubleBottom && pattern.patternLevel != null
    ? pattern.patternLevel
    : parseFloat((indicators.sma200 * 0.92).toFixed(2));

  const { type: verdictType, text: verdict } = computeVerdict(
    indicators, audit, wick, pattern, buyTarget, last.close
  );

  const prevClose = bars[bars.length - 2].close;
  const change    = parseFloat((last.close - prevClose).toFixed(2));
  const changePercent = parseFloat(((change / prevClose) * 100).toFixed(2));

  return {
    ticker: ticker.toUpperCase(),
    name: meta.name,
    sector: meta.sector,
    strategy: meta.strategy,
    price: last.close,
    change,
    changePercent,
    buyTarget,
    stop,
    floor,
    verdict,
    verdictType,
    notifyEnabled: notifyPrefs[ticker] ?? false,
    indicators,
    wick,
    audit,
    pattern,
    lastUpdated: new Date().toISOString(),
  };
}

export function setNotify(ticker: string, enabled: boolean) {
  notifyPrefs[ticker.toUpperCase()] = enabled;
}

export { METADATA };
