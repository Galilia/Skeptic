import type { ColDef, ValueGetterParams, ICellRendererParams } from 'ag-grid-community';
import type { ProcessedStock, VerdictType } from '@/entities/stock';
import { VERDICT_COLORS, VERDICT_BG } from '@/entities/stock';

/** Formats a dollar value with 2 decimal places */
const usd = (v: number) => `$${v.toFixed(2)}`;

/** Classifies proximity to buy target */
function priceProximityClass(price: number, buyTarget: number, stop: number): string {
  const distToBuy = Math.abs((price - buyTarget) / buyTarget) * 100;
  const distToStop = Math.abs((price - stop) / stop) * 100;
  if (distToBuy <= 1.0) return 'near-buy-target';
  if (distToStop <= 1.0) return 'near-stop';
  return '';
}

const baseColDef: Partial<ColDef<ProcessedStock>> = {
  sortable: true,
  resizable: true,
  filter: true,
  minWidth: 80,
};

/** Ticker column with sector group support */
const tickerCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'ticker',
  headerName: 'Ticker',
  width: 90,
  pinned: 'left',
  cellRenderer: (params: ICellRendererParams<ProcessedStock>) => {
    const d = params.data;
    if (!d) return '';
    return `<div class="ticker-cell">
      <span class="ticker-symbol">${d.ticker}</span>
      <span class="ticker-name">${d.name}</span>
    </div>`;
  },
  rowGroup: false,
};

/** Current price with color-coded change */
const priceCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'price',
  headerName: 'Price',
  width: 110,
  valueFormatter: (p) => p.value != null ? usd(p.value) : '—',
  cellClassRules: {
    'near-buy-target': (p) => {
      const d = p.data as ProcessedStock;
      return d ? Math.abs((d.price - d.buyTarget) / d.buyTarget) * 100 <= 1.0 : false;
    },
    'near-stop': (p) => {
      const d = p.data as ProcessedStock;
      return d ? Math.abs((d.price - d.stop) / d.stop) * 100 <= 1.0 : false;
    },
  },
  cellRenderer: (params: ICellRendererParams<ProcessedStock>) => {
    const d = params.data;
    if (!d) return '';
    const changeClass = d.change >= 0 ? 'positive' : 'negative';
    const sign = d.change >= 0 ? '+' : '';
    return `<div class="price-cell">
      <span class="price-value">${usd(d.price)}</span>
      <span class="price-change ${changeClass}">${sign}${d.change.toFixed(2)} (${sign}${d.changePercent.toFixed(2)}%)</span>
    </div>`;
  },
};

/** Buy Target — the "Action Zone" where wick and SMA50 intersect */
const buyTargetCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'buyTarget',
  headerName: 'Buy Target',
  width: 110,
  valueFormatter: (p) => p.value != null ? usd(p.value) : '—',
  cellRenderer: (params: ICellRendererParams<ProcessedStock>) => {
    const d = params.data;
    if (!d) return '';
    const isClose = Math.abs((d.price - d.buyTarget) / d.buyTarget) * 100 <= 1.0;
    return `<div class="buy-target-cell ${isClose ? 'pulsing-green' : ''}">
      <span>${usd(d.buyTarget)}</span>
      ${d.wick.hasAggressiveBuySignal ? '<span class="wick-badge">🔥 Wick</span>' : ''}
    </div>`;
  },
};

/** Hard Stop — swing low minus 1.0x ATR */
const stopCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'stop',
  headerName: 'Stop',
  width: 95,
  valueFormatter: (p) => p.value != null ? usd(p.value) : '—',
  cellClassRules: {
    'near-stop': (p) => {
      const d = p.data as ProcessedStock;
      return d ? Math.abs((d.price - d.stop) / d.stop) * 100 <= 1.0 : false;
    },
  },
};

/** Floor — absolute structural bottom (Double Bottom base) */
const floorCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'floor',
  headerName: 'Floor',
  width: 95,
  valueFormatter: (p) => p.value != null ? usd(p.value) : '—',
};

/** Verdict — one-sentence RSI + Volume + Trend analysis */
const verdictCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'verdict',
  headerName: 'Verdict',
  flex: 1,
  minWidth: 280,
  filter: 'agTextColumnFilter',
  sortable: false,
  cellRenderer: (params: ICellRendererParams<ProcessedStock>) => {
    const d = params.data;
    if (!d) return '';
    const color = VERDICT_COLORS[d.verdictType as VerdictType];
    const bg = VERDICT_BG[d.verdictType as VerdictType];
    const warnings = d.audit.warnings.length > 0
      ? `<div class="audit-warnings">${d.audit.warnings.map((w) => `<span class="warning-badge">${w}</span>`).join('')}</div>`
      : '';
    return `<div class="verdict-cell" style="border-left: 3px solid ${color}; background: ${bg}; padding: 4px 10px; border-radius: 4px;">
      <span class="verdict-badge" style="color:${color}; font-weight:600;">${d.verdictType}</span>
      <span class="verdict-text">${d.verdict.replace(`${d.verdictType}: `, '')}</span>
      ${warnings}
    </div>`;
  },
};

/** RSI indicator with overbought/oversold coloring */
const rsiCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  headerName: 'RSI',
  width: 80,
  valueGetter: (p: ValueGetterParams<ProcessedStock>) => p.data?.indicators.rsi14,
  valueFormatter: (p) => p.value != null ? p.value.toFixed(1) : '—',
  cellClassRules: {
    'rsi-overbought': (p) => (p.data as ProcessedStock)?.indicators.rsi14 > 70,
    'rsi-oversold': (p) => (p.data as ProcessedStock)?.indicators.rsi14 < 30,
  },
};

/** SMA50 proximity percentage */
const smaProximityCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  headerName: 'SMA50 %',
  width: 90,
  valueGetter: (p: ValueGetterParams<ProcessedStock>) => p.data?.indicators.smaProximityPct,
  valueFormatter: (p) => p.value != null ? `${p.value > 0 ? '+' : ''}${p.value.toFixed(2)}%` : '—',
  cellClassRules: {
    'sma-positive': (p) => (p.data as ProcessedStock)?.indicators.smaProximityPct > 0,
    'sma-negative': (p) => (p.data as ProcessedStock)?.indicators.smaProximityPct < 0,
    'sma-overextended': (p) => (p.data as ProcessedStock)?.indicators.smaProximityPct > 12,
  },
};

/** ATR14 for volatility context */
const atrCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  headerName: 'ATR14',
  width: 80,
  valueGetter: (p: ValueGetterParams<ProcessedStock>) => p.data?.indicators.atr14,
  valueFormatter: (p) => p.value != null ? usd(p.value) : '—',
};

/** Notify toggle column */
const notifyCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'notifyEnabled',
  headerName: 'Notify',
  width: 80,
  sortable: false,
  filter: false,
  cellRenderer: 'notifyCellRenderer',
  cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

export function getStockColumnDefs(): ColDef<ProcessedStock>[] {
  return [
    tickerCol,
    priceCol,
    buyTargetCol,
    stopCol,
    floorCol,
    verdictCol,
    rsiCol,
    smaProximityCol,
    atrCol,
    notifyCol,
  ];
}

export function getGroupColumnDef(): ColDef<ProcessedStock> {
  return {
    field: 'sector',
    headerName: 'Sector',
    rowGroup: true,
    hide: true,
  };
}
