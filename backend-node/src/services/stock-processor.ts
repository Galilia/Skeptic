import type { OhlcvBar, ProcessedStock } from '../types.js';
import { computeIndicators } from '../indicators/indicator-engine.js';
import { detectWick } from '../indicators/wick-detector.js';
import { scanPatterns } from '../patterns/pattern-scanner.js';
import { runAudit, computeVerdict } from '../audit/skeptic-auditor.js';
import { getCachedBars } from './history-cache.js';

const METADATA: Record<string, { name: string; sector: string; strategy: string }> = {
  ADM:   { name: 'Archer-Daniels-Midland', sector: 'Consumer Staples',       strategy: 'Value'    },
  NVDA:  { name: 'NVIDIA Corporation',      sector: 'Technology',             strategy: 'Momentum' },
  GE:    { name: 'GE Aerospace',            sector: 'Industrials',            strategy: 'Growth'   },
  GOOGL: { name: 'Alphabet Inc.',           sector: 'Technology',             strategy: 'Growth'   },
  INTC:  { name: 'Intel Corporation',       sector: 'Technology',             strategy: 'Value'    },
  MSFT:  { name: 'Microsoft Corporation',   sector: 'Technology',             strategy: 'Growth'   },
  JPM:   { name: 'JPMorgan Chase',          sector: 'Financials',             strategy: 'Dividend' },
  XOM:   { name: 'Exxon Mobil',             sector: 'Energy',                 strategy: 'Dividend' },
  TSLA:  { name: 'Tesla Inc.',              sector: 'Consumer Discretionary', strategy: 'Momentum' },
  META:  { name: 'Meta Platforms',          sector: 'Technology',             strategy: 'Growth'   },
};

// Live prices fetched by index.ts and injected here before each broadcast
const livePrices: Record<string, number> = {};

export function setLivePrices(prices: Record<string, number>): void {
  Object.assign(livePrices, prices);
}

const notifyPrefs: Record<string, boolean> = {};

/** Full Skeptic's Engine pipeline for one ticker (async — uses real Yahoo data). */
export async function processStock(ticker: string): Promise<ProcessedStock | null> {
  const meta = METADATA[ticker.toUpperCase()];
  if (!meta) return null;

  const livePrice = livePrices[ticker.toUpperCase()];
  const bars: OhlcvBar[] = await getCachedBars(ticker.toUpperCase(), 220, livePrice);
  if (bars.length < 2) return null;

  const last        = bars[bars.length - 1];
  const indicators  = computeIndicators(bars);
  const wick        = detectWick(bars);
  const pattern     = scanPatterns(bars);
  const audit       = runAudit(indicators, last.volume, last.avgVolume5d);

  // Action levels
  const buyTarget = parseFloat((indicators.sma50 * 0.7 + last.low * 0.3).toFixed(2));
  const stop      = parseFloat((last.low - indicators.atr14).toFixed(2));
  const floor     = pattern.hasDoubleBottom && pattern.patternLevel != null
    ? pattern.patternLevel
    : parseFloat((indicators.sma200 * 0.92).toFixed(2));

  const { type: verdictType, text: verdict } = computeVerdict(
    indicators, audit, wick, pattern, buyTarget, last.close
  );

  const prevClose     = bars[bars.length - 2].close;
  const change        = parseFloat((last.close - prevClose).toFixed(2));
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
    notifyEnabled: notifyPrefs[ticker.toUpperCase()] ?? false,
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
