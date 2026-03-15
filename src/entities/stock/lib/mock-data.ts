import type { ProcessedStock, VerdictType, TrendDirection, FibLevel, SRLevel, NearFibLevel } from '../model/types/stock';

// Base entries — only static/manually-set fields; all derived fields are computed in getMockStocks
type MockBase = Omit<
  ProcessedStock,
  | 'lastUpdated' | 'priceOnSma150' | 'priceOnSma200' | 'volumeConfirmed' | 'volumeSpike'
  | 'shortTrend' | 'longTrend' | 'trendAligned' | 'nearBuyTarget' | 'nearStop'
  | 'supportLevels' | 'resistanceLevels' | 'fibLevels' | 'nearFibLevel' | 'riskRewardRatio'
  | 'fearGreedValue' | 'fearGreedLabel'
  | 'sectorChangePercent' | 'sectorTrend' | 'sectorEtfTicker'
  | 'analystConsensus' | 'analystCount'
  | 'stopAtrMultiplier'
  | 'redFlags'
  | 'indicators'
  | 'nextEarningsDate' | 'earningsInDays' | 'earningsWarning'
  | 'insiderSentiment' | 'recentInsiderActivity'
> & {
  indicators: Omit<ProcessedStock['indicators'], 'sma20' | 'sma150'>;
};

const MOCK_STOCKS: MockBase[] = [
  {
    ticker: 'ADM',
    name: 'Archer-Daniels-Midland',
    sector: 'Consumer Staples',
    strategy: 'Value',
    price: 71.80,
    change: 0.45,
    changePercent: 0.63,
    buyTarget: 70.50,
    stop: 69.50,
    floor: 63.80,
    verdict: 'BUY: Near SMA 50. Strong buyers at 70.50.',
    verdictType: 'BUY',
    notifyEnabled: true,
    indicators: { sma50: 71.10, sma200: 68.40, rsi14: 52.3, atr14: 1.20, smaProximityPct: 0.99 },
    wick: { lowerWick: 1.85, upperWick: 0.42, hasAggressiveBuySignal: true },
    audit: { isOverbought: false, isOverextended: false, isWeakMomentum: false, warnings: [] },
    pattern: { hasDoubleBottom: true, hasDoubleTop: false, patternLevel: 70.50, patternDescription: 'Double Bottom at 70.50 – confirmed buyers zone' },
    peRatio: 15.2,
  },
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    sector: 'Technology',
    strategy: 'Momentum',
    price: 183.04,
    change: -2.14,
    changePercent: -1.16,
    buyTarget: 176.00,
    stop: 170.00,
    floor: 158.00,
    verdict: 'WAIT: Overextended. High risk before GTC.',
    verdictType: 'WAIT',
    notifyEnabled: false,
    indicators: { sma50: 161.80, sma200: 148.20, rsi14: 74.1, atr14: 5.80, smaProximityPct: 13.1 },
    wick: { lowerWick: 0.92, upperWick: 2.40, hasAggressiveBuySignal: false },
    audit: { isOverbought: true, isOverextended: true, isWeakMomentum: false, warnings: ['RSI > 70 — Overbought', 'Price >12% above SMA50 — Overextended'] },
    pattern: { hasDoubleBottom: false, hasDoubleTop: false, patternLevel: null, patternDescription: null },
    peRatio: 45.1,
  },
  {
    ticker: 'GE',
    name: 'GE Aerospace',
    sector: 'Industrials',
    strategy: 'Growth',
    price: 304.72,
    change: -5.20,
    changePercent: -1.68,
    buyTarget: 290.00,
    stop: 298.00,
    floor: 280.00,
    verdict: 'AVOID: Trend broken. No buyers detected.',
    verdictType: 'AVOID',
    notifyEnabled: true,
    indicators: { sma50: 318.40, sma200: 295.10, rsi14: 38.2, atr14: 7.40, smaProximityPct: -4.30 },
    wick: { lowerWick: 0.55, upperWick: 3.80, hasAggressiveBuySignal: false },
    audit: { isOverbought: false, isOverextended: false, isWeakMomentum: true, warnings: ['Volume < 5-day avg — Weak Momentum'] },
    pattern: { hasDoubleBottom: false, hasDoubleTop: true, patternLevel: 310.00, patternDescription: 'Double Top at 310.00 — distribution pattern' },
    peRatio: 28.4,
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    sector: 'Technology',
    strategy: 'Growth',
    price: 303.73,
    change: 1.88,
    changePercent: 0.62,
    buyTarget: 298.50,
    stop: 295.00,
    floor: 285.00,
    verdict: 'ACCUMULATE: Solid Double Bottom support.',
    verdictType: 'ACCUMULATE',
    notifyEnabled: false,
    indicators: { sma50: 299.20, sma200: 278.80, rsi14: 58.7, atr14: 6.10, smaProximityPct: 1.51 },
    wick: { lowerWick: 2.10, upperWick: 0.80, hasAggressiveBuySignal: true },
    audit: { isOverbought: false, isOverextended: false, isWeakMomentum: false, warnings: [] },
    pattern: { hasDoubleBottom: true, hasDoubleTop: false, patternLevel: 295.00, patternDescription: 'Double Bottom at 295.00 — strong structural floor' },
    peRatio: 22.8,
  },
  {
    ticker: 'INTC',
    name: 'Intel Corporation',
    sector: 'Technology',
    strategy: 'Value',
    price: 45.52,
    change: -1.20,
    changePercent: -2.57,
    buyTarget: 42.30,
    stop: 44.00,
    floor: 39.50,
    verdict: 'DANGER: Falling knife. Watch the floor.',
    verdictType: 'DANGER',
    notifyEnabled: true,
    indicators: { sma50: 48.90, sma200: 52.30, rsi14: 28.4, atr14: 1.50, smaProximityPct: -6.92 },
    wick: { lowerWick: 0.28, upperWick: 1.95, hasAggressiveBuySignal: false },
    audit: { isOverbought: false, isOverextended: false, isWeakMomentum: true, warnings: ['Volume < 5-day avg — Weak Momentum', 'Below SMA50 and SMA200 — Bearish trend'] },
    pattern: { hasDoubleBottom: false, hasDoubleTop: false, patternLevel: null, patternDescription: null },
    peRatio: null,
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    sector: 'Technology',
    strategy: 'Growth',
    price: 415.30,
    change: 3.22,
    changePercent: 0.78,
    buyTarget: 408.00,
    stop: 400.00,
    floor: 385.00,
    verdict: 'BUY: Tight coil above SMA50. Volume confirming.',
    verdictType: 'BUY',
    notifyEnabled: false,
    indicators: { sma50: 410.50, sma200: 388.40, rsi14: 61.2, atr14: 8.20, smaProximityPct: 1.17 },
    wick: { lowerWick: 3.10, upperWick: 1.05, hasAggressiveBuySignal: true },
    audit: { isOverbought: false, isOverextended: false, isWeakMomentum: false, warnings: [] },
    pattern: { hasDoubleBottom: false, hasDoubleTop: false, patternLevel: null, patternDescription: null },
    peRatio: 32.1,
  },
  {
    ticker: 'JPM',
    name: 'JPMorgan Chase',
    sector: 'Financials',
    strategy: 'Dividend',
    price: 218.45,
    change: -0.85,
    changePercent: -0.39,
    buyTarget: 213.00,
    stop: 209.50,
    floor: 198.00,
    verdict: 'ACCUMULATE: Pullback to SMA50. Dividend support.',
    verdictType: 'ACCUMULATE',
    notifyEnabled: true,
    indicators: { sma50: 214.20, sma200: 200.30, rsi14: 55.8, atr14: 4.30, smaProximityPct: 2.00 },
    wick: { lowerWick: 1.60, upperWick: 0.70, hasAggressiveBuySignal: false },
    audit: { isOverbought: false, isOverextended: false, isWeakMomentum: false, warnings: [] },
    pattern: { hasDoubleBottom: true, hasDoubleTop: false, patternLevel: 210.00, patternDescription: 'Double Bottom at 210.00 — strong buyers zone' },
    peRatio: 12.4,
  },
  {
    ticker: 'XOM',
    name: 'Exxon Mobil',
    sector: 'Energy',
    strategy: 'Dividend',
    price: 108.20,
    change: 1.10,
    changePercent: 1.03,
    buyTarget: 105.50,
    stop: 103.00,
    floor: 97.00,
    verdict: 'BUY: Energy recovery play. Wick confirms buyers.',
    verdictType: 'BUY',
    notifyEnabled: false,
    indicators: { sma50: 106.80, sma200: 103.20, rsi14: 59.4, atr14: 2.10, smaProximityPct: 1.31 },
    wick: { lowerWick: 2.85, upperWick: 0.40, hasAggressiveBuySignal: true },
    audit: { isOverbought: false, isOverextended: false, isWeakMomentum: false, warnings: [] },
    pattern: { hasDoubleBottom: false, hasDoubleTop: false, patternLevel: null, patternDescription: null },
    peRatio: 14.2,
  },
  {
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    sector: 'Consumer Discretionary',
    strategy: 'Momentum',
    price: 242.80,
    change: -8.40,
    changePercent: -3.34,
    buyTarget: 225.00,
    stop: 235.00,
    floor: 210.00,
    verdict: 'WAIT: Volatile. Wait for floor confirmation.',
    verdictType: 'WAIT',
    notifyEnabled: false,
    indicators: { sma50: 228.40, sma200: 215.80, rsi14: 48.1, atr14: 12.50, smaProximityPct: 6.29 },
    wick: { lowerWick: 4.20, upperWick: 6.80, hasAggressiveBuySignal: false },
    audit: { isOverbought: false, isOverextended: false, isWeakMomentum: true, warnings: ['Volume < 5-day avg — Weak Momentum'] },
    pattern: { hasDoubleBottom: false, hasDoubleTop: false, patternLevel: null, patternDescription: null },
    peRatio: 68.5,
  },
  {
    ticker: 'META',
    name: 'Meta Platforms',
    sector: 'Technology',
    strategy: 'Growth',
    price: 558.90,
    change: 4.75,
    changePercent: 0.86,
    buyTarget: 545.00,
    stop: 535.00,
    floor: 510.00,
    verdict: 'ACCUMULATE: AI spend justified. Near breakout.',
    verdictType: 'ACCUMULATE',
    notifyEnabled: false,
    indicators: { sma50: 548.20, sma200: 498.40, rsi14: 64.3, atr14: 14.20, smaProximityPct: 1.95 },
    wick: { lowerWick: 2.90, upperWick: 1.40, hasAggressiveBuySignal: false },
    audit: { isOverbought: false, isOverextended: false, isWeakMomentum: false, warnings: [] },
    pattern: { hasDoubleBottom: false, hasDoubleTop: false, patternLevel: null, patternDescription: null },
    peRatio: 26.3,
  },
];

const SECTOR_ETF_MAP: Record<string, string> = {
  'Technology':             'XLK',
  'Financials':             'XLF',
  'Energy':                 'XLE',
  'Consumer Staples':       'XLP',
  'Consumer Discretionary': 'XLY',
  'Industrials':            'XLI',
  'Health Care':            'XLV',
  'Materials':              'XLB',
};

/** Adds random micro-noise to simulate live price updates */
function jitterPrice(base: number, volatility = 0.003): number {
  const noise = (Math.random() - 0.5) * 2 * volatility;
  return parseFloat((base * (1 + noise)).toFixed(2));
}

/** Build mock fibonacci levels from rough swing range */
function mockFibLevels(hi: number, lo: number): FibLevel[] {
  const range = hi - lo;
  if (range <= 0) return [];
  return [
    { pct: 23.6, label: '23.6%', price: parseFloat((hi - range * 0.236).toFixed(2)) },
    { pct: 38.2, label: '38.2%', price: parseFloat((hi - range * 0.382).toFixed(2)) },
    { pct: 50.0, label: '50%',   price: parseFloat((hi - range * 0.500).toFixed(2)) },
    { pct: 61.8, label: '61.8%', price: parseFloat((hi - range * 0.618).toFixed(2)) },
    { pct: 78.6, label: '78.6%', price: parseFloat((hi - range * 0.786).toFixed(2)) },
  ];
}

/** Compute NearFibLevel from a list of fib levels and current price */
function computeNearFibLevel(fibs: FibLevel[], price: number): NearFibLevel | null {
  if (!fibs.length) return null;
  let best = fibs[0];
  let minDist = Math.abs(price - fibs[0].price);
  for (const f of fibs) {
    const d = Math.abs(price - f.price);
    if (d < minDist) { minDist = d; best = f; }
  }
  const distance = parseFloat((minDist / price * 100).toFixed(2));
  return { label: best.label, price: best.price, distance, isNear: distance <= 1.5 };
}

/** Build mock S/R levels with touch counts */
function mockSRLevels(prices: number[]): SRLevel[] {
  return prices.filter(Boolean).map((p) => ({ price: p, touches: 3 + Math.floor(Math.random() * 3) }));
}

/** Compute red flags from stock data (mirrors backend logic for mock data) */
function computeMockRedFlags(s: MockBase, trendAligned: boolean, resistanceLevels: SRLevel[], price: number): string[] {
  const flags: string[] = [];
  if (s.indicators.rsi14 > 70) flags.push(`RSI ${s.indicators.rsi14.toFixed(1)} > 70 — Overbought`);
  if (s.indicators.rsi14 < 30) flags.push(`RSI ${s.indicators.rsi14.toFixed(1)} < 30 — Oversold (falling knife risk)`);
  if (s.indicators.smaProximityPct > 12) flags.push(`Price +${s.indicators.smaProximityPct.toFixed(1)}% above SMA50 — Overextended`);
  if (s.audit.isWeakMomentum) flags.push('Volume < 5-day avg — No conviction');
  if (!trendAligned) flags.push('Trend NOT aligned — Short vs Long conflict');
  if (resistanceLevels.length > 0) {
    const upside = (resistanceLevels[0].price - price) / price * 100;
    if (upside <= 2) flags.push(`Near strong resistance ($${resistanceLevels[0].price.toFixed(2)}) — Limited upside`);
  }
  const sma150 = s.indicators.sma200 * 1.030;
  if (price < sma150 && price < s.indicators.sma200) flags.push('Below SMA150 and SMA200 — Bearish structure');
  if (s.pattern.hasDoubleTop) flags.push('Double Top pattern — Distribution signal');
  if (s.peRatio !== null && s.peRatio > 40) flags.push(`P/E ${s.peRatio.toFixed(1)} > 40 — Expensive valuation`);
  return flags;
}

export function getMockStocks(): ProcessedStock[] {
  return MOCK_STOCKS.map((s) => {
    const price = jitterPrice(s.price);

    // Approximate SMA20 and SMA150 from existing SMA50/200 data
    const sma20  = parseFloat((s.indicators.sma50  * 0.988).toFixed(2));
    const sma150 = parseFloat((s.indicators.sma200 * 1.030).toFixed(2));
    const indicators = { ...s.indicators, sma20, sma150 };

    const volumeConfirmed = !s.audit.isWeakMomentum;
    const volumeSpike     = false;

    const smaProx = s.indicators.smaProximityPct;
    const shortTrend: TrendDirection = smaProx > 3 ? 'UP' : smaProx < -3 ? 'DOWN' : 'SIDEWAYS';
    const longTrend: TrendDirection  = price > s.indicators.sma200 ? 'UP' : 'DOWN';
    const trendAligned = shortTrend === 'UP' && longTrend === 'UP';

    const nearBuyTarget = Math.abs(price - s.buyTarget) / s.buyTarget * 100 <= 2.5;
    const nearStop      = Math.abs(price - s.stop)      / s.stop      * 100 <= 1.5;

    const priceOnSma150 = Math.abs(price - sma150) / sma150 * 100 <= 1.5;
    const priceOnSma200 = Math.abs(price - indicators.sma200) / indicators.sma200 * 100 <= 1.5;

    const swingHi = Math.max(price, s.indicators.sma50)  * 1.06;
    const swingLo = Math.min(price, s.indicators.sma200) * 0.94;
    const fibLevels = mockFibLevels(swingHi, swingLo);
    const nearFibLevel = computeNearFibLevel(fibLevels, price);

    const riskRewardRatio = (s.buyTarget - s.stop) > 0
      ? parseFloat(((s.indicators.atr14 * 2) / (s.buyTarget - s.stop)).toFixed(2))
      : 0;

    const resistanceLevels: SRLevel[] = mockSRLevels([
      parseFloat((s.indicators.sma50 * 1.05).toFixed(2)),
      parseFloat((s.indicators.sma50 * 1.10).toFixed(2)),
    ]);
    const supportLevels: SRLevel[] = mockSRLevels([s.stop, s.floor].filter(Boolean));

    const stopAtrMultiplier = s.indicators.smaProximityPct > 5 ? 1.5 : 1.0;
    const sectorEtfTicker   = SECTOR_ETF_MAP[s.sector] ?? '';
    const sectorChangePercent = parseFloat(((Math.random() - 0.5) * 2).toFixed(2));
    const sectorTrend: TrendDirection = sectorChangePercent > 0.3 ? 'UP' : sectorChangePercent < -0.3 ? 'DOWN' : 'SIDEWAYS';

    const redFlags = computeMockRedFlags(s, trendAligned, resistanceLevels, price);

    return {
      ...s,
      price,
      lastUpdated: new Date().toISOString(),
      indicators,
      priceOnSma150,
      priceOnSma200,
      volumeConfirmed,
      volumeSpike,
      shortTrend,
      longTrend,
      trendAligned,
      nearBuyTarget,
      nearStop,
      fearGreedValue: 48,
      fearGreedLabel: 'Fear',
      supportLevels,
      resistanceLevels,
      fibLevels,
      nearFibLevel,
      riskRewardRatio,
      sectorChangePercent,
      sectorTrend,
      sectorEtfTicker,
      analystConsensus: ['Strong Buy', 'Buy', 'Hold'][Math.floor(Math.random() * 3)],
      analystCount: Math.floor(Math.random() * 20) + 5,
      stopAtrMultiplier,
      redFlags,
      nextEarningsDate: null,
      earningsInDays: null,
      earningsWarning: false,
      insiderSentiment: null,
      recentInsiderActivity: null,
    };
  });
}

export function getMockStockUpdate(ticker: string): ProcessedStock | undefined {
  const base = MOCK_STOCKS.find((s) => s.ticker === ticker);
  if (!base) return undefined;
  const newPrice = jitterPrice(base.price);
  const newChange = parseFloat((newPrice - base.price + base.change).toFixed(2));
  const newChangePct = parseFloat(((newChange / base.price) * 100).toFixed(2));
  const sma20  = parseFloat((base.indicators.sma50  * 0.988).toFixed(2));
  const sma150 = parseFloat((base.indicators.sma200 * 1.030).toFixed(2));
  const indicators = { ...base.indicators, sma20, sma150 };
  const shortTrend: TrendDirection = base.indicators.smaProximityPct > 3 ? 'UP' : base.indicators.smaProximityPct < -3 ? 'DOWN' : 'SIDEWAYS';
  const longTrend: TrendDirection  = newPrice > base.indicators.sma200 ? 'UP' : 'DOWN';
  const trendAligned = shortTrend === 'UP' && longTrend === 'UP';
  const swingHi = Math.max(newPrice, base.indicators.sma50)  * 1.06;
  const swingLo = Math.min(newPrice, base.indicators.sma200) * 0.94;
  const fibLevels = mockFibLevels(swingHi, swingLo);
  const resistanceLevels: SRLevel[] = mockSRLevels([
    parseFloat((base.indicators.sma50 * 1.05).toFixed(2)),
    parseFloat((base.indicators.sma50 * 1.10).toFixed(2)),
  ]);
  const supportLevels: SRLevel[] = mockSRLevels([base.stop, base.floor].filter(Boolean));
  const sectorChangePercent = parseFloat(((Math.random() - 0.5) * 2).toFixed(2));
  const sectorTrend: TrendDirection = sectorChangePercent > 0.3 ? 'UP' : sectorChangePercent < -0.3 ? 'DOWN' : 'SIDEWAYS';

  return {
    ...base,
    price: newPrice,
    change: newChange,
    changePercent: newChangePct,
    lastUpdated: new Date().toISOString(),
    indicators,
    priceOnSma150: Math.abs(newPrice - sma150) / sma150 * 100 <= 1.5,
    priceOnSma200: Math.abs(newPrice - indicators.sma200) / indicators.sma200 * 100 <= 1.5,
    volumeConfirmed: !base.audit.isWeakMomentum,
    volumeSpike: false,
    shortTrend,
    longTrend,
    trendAligned,
    nearBuyTarget: Math.abs(newPrice - base.buyTarget) / base.buyTarget * 100 <= 2.5,
    nearStop: Math.abs(newPrice - base.stop) / base.stop * 100 <= 1.5,
    fearGreedValue: 48,
    fearGreedLabel: 'Fear',
    supportLevels,
    resistanceLevels,
    fibLevels,
    nearFibLevel: computeNearFibLevel(fibLevels, newPrice),
    riskRewardRatio: (base.buyTarget - base.stop) > 0
      ? parseFloat(((base.indicators.atr14 * 2) / (base.buyTarget - base.stop)).toFixed(2))
      : 0,
    sectorChangePercent,
    sectorTrend,
    sectorEtfTicker: SECTOR_ETF_MAP[base.sector] ?? '',
    analystConsensus: 'N/A',
    analystCount: 0,
    stopAtrMultiplier: base.indicators.smaProximityPct > 5 ? 1.5 : 1.0,
    redFlags: computeMockRedFlags(base, trendAligned, resistanceLevels, newPrice),
    nextEarningsDate: null,
    earningsInDays: null,
    earningsWarning: false,
    insiderSentiment: null,
    recentInsiderActivity: null,
  };
}

export const ALL_SECTORS = [...new Set(MOCK_STOCKS.map((s) => s.sector))].sort();
export const ALL_STRATEGIES = [...new Set(MOCK_STOCKS.map((s) => s.strategy))].sort();
export const ALL_VERDICTS: VerdictType[] = ['BUY', 'ACCUMULATE', 'WAIT', 'AVOID', 'DANGER'];
