import type { CSSProperties } from 'react';
import type { ColDef, ValueGetterParams, ICellRendererParams } from 'ag-grid-community';
import type { ProcessedStock, VerdictType } from '@/entities/stock';
import { VERDICT_COLORS, VERDICT_BG } from '@/entities/stock';

const usd = (v: number) => `$${v.toFixed(2)}`;

const noWrap: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

// ── Cell Renderer Components ──────────────────────────────────────────────────

function TickerCellRenderer({ data }: ICellRendererParams<ProcessedStock>) {
  if (!data) return null;
  return (
    <div className="ticker-cell" style={noWrap}>
      <span className="ticker-symbol">{data.ticker}</span>
      <span className="ticker-name">{data.name}</span>
    </div>
  );
}

function PriceCellRenderer({ data }: ICellRendererParams<ProcessedStock>) {
  if (!data) return null;
  const changeClass = data.change >= 0 ? 'positive' : 'negative';
  const sign = data.change >= 0 ? '+' : '';
  return (
    <div className="price-cell" style={noWrap}>
      <span className="price-value">{usd(data.price)}</span>
      <span className={`price-change ${changeClass}`}>
        {sign}{data.change.toFixed(2)} ({sign}{data.changePercent.toFixed(2)}%)
      </span>
    </div>
  );
}

function BuyTargetCellRenderer({ data }: ICellRendererParams<ProcessedStock>) {
  if (!data) return null;
  const isClose = Math.abs((data.price - data.buyTarget) / data.buyTarget) * 100 <= 1.0;
  return (
    <div className={`buy-target-cell${isClose ? ' pulsing-green' : ''}`} style={noWrap}>
      <span>{usd(data.buyTarget)}</span>
      {data.wick.hasAggressiveBuySignal && <span className="wick-badge">🔥 Wick</span>}
    </div>
  );
}

function VerdictCellRenderer({ data }: ICellRendererParams<ProcessedStock>) {
  if (!data) return null;
  const color = VERDICT_COLORS[data.verdictType as VerdictType];
  const bg = VERDICT_BG[data.verdictType as VerdictType];
  return (
    <div
      className="verdict-cell"
      style={{
        ...noWrap,
        borderLeft: `3px solid ${color}`,
        background: bg,
        padding: '4px 10px',
        borderRadius: 4,
      }}
    >
      <span className="verdict-badge" style={{ color, fontWeight: 600 }}>{data.verdictType}</span>
      <span className="verdict-text">{data.verdict.replace(`${data.verdictType}: `, '')}</span>
      {data.audit.warnings.length > 0 && (
        <div className="audit-warnings">
          {data.audit.warnings.map((w, i) => (
            <span key={i} className="warning-badge">{w}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Column Definitions ────────────────────────────────────────────────────────

const baseColDef: Partial<ColDef<ProcessedStock>> = {
  sortable: true,
  resizable: true,
  filter: true,
  minWidth: 80,
  wrapText: false,
};

const tickerCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'ticker',
  headerName: 'Ticker',
  width: 140,
  pinned: 'left',
  cellRenderer: TickerCellRenderer,
};

const priceCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'price',
  headerName: 'Price',
  width: 130,
  cellRenderer: PriceCellRenderer,
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
};

const buyTargetCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'buyTarget',
  headerName: 'Buy Target',
  width: 120,
  cellRenderer: BuyTargetCellRenderer,
};

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

const floorCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'floor',
  headerName: 'Floor',
  width: 95,
  valueFormatter: (p) => p.value != null ? usd(p.value) : '—',
};

const verdictCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  field: 'verdict',
  headerName: 'Verdict',
  flex: 1,
  minWidth: 250,
  filter: 'agTextColumnFilter',
  sortable: false,
  cellRenderer: VerdictCellRenderer,
};

const rsiCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  headerName: 'RSI',
  width: 80,
  valueGetter: (p: ValueGetterParams<ProcessedStock>) => p.data?.indicators?.rsi14,
  valueFormatter: (p) => p.value != null ? p.value.toFixed(1) : '—',
  cellClassRules: {
    'rsi-overbought': (p) => ((p.data as ProcessedStock)?.indicators?.rsi14 ?? 0) > 70,
    'rsi-oversold': (p) => ((p.data as ProcessedStock)?.indicators?.rsi14 ?? 0) < 30,
  },
};

const smaProximityCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  headerName: 'SMA50 %',
  width: 90,
  valueGetter: (p: ValueGetterParams<ProcessedStock>) => p.data?.indicators?.smaProximityPct,
  valueFormatter: (p) => p.value != null ? `${p.value > 0 ? '+' : ''}${p.value.toFixed(2)}%` : '—',
  cellClassRules: {
    'sma-positive': (p) => ((p.data as ProcessedStock)?.indicators?.smaProximityPct ?? 0) > 0,
    'sma-negative': (p) => ((p.data as ProcessedStock)?.indicators?.smaProximityPct ?? 0) < 0,
    'sma-overextended': (p) => ((p.data as ProcessedStock)?.indicators?.smaProximityPct ?? 0) > 12,
  },
};

const atrCol: ColDef<ProcessedStock> = {
  ...baseColDef,
  headerName: 'ATR14',
  width: 80,
  valueGetter: (p: ValueGetterParams<ProcessedStock>) => p.data?.indicators?.atr14,
  valueFormatter: (p) => p.value != null ? usd(p.value) : '—',
};

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
