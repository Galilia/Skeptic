import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { useTerminalStore } from '@/shared/model/terminal-store';
import { useSignalRConnection } from '@/shared/lib/use-signalr-connection';
import {
  ALL_SECTORS,
  ALL_STRATEGIES,
  ALL_VERDICTS,
  VERDICT_COLORS,
  VERDICT_BG,
  type ProcessedStock,
  type VerdictType,
} from '@/entities/stock';
import { getStockColumnDefs } from '@/widgets/stock-table/lib/column-defs';
import '@/app/styles/terminal.css';

ModuleRegistry.registerModules([AllCommunityModule]);

// ── NotifyCellRenderer ────────────────────────────────────────────────────────
function NotifyCellRenderer(props: {
  data: ProcessedStock;
  context: { onToggleNotify: (t: string) => void };
}) {
  const { data, context } = props;
  if (!data) return null;
  return (
    <button
      className={`notify-toggle ${data.notifyEnabled ? 'enabled' : 'disabled'}`}
      onClick={(e) => { e.stopPropagation(); context.onToggleNotify(data.ticker); }}
      title={data.notifyEnabled ? 'Alerts ON' : 'Alerts OFF'}
    >
      {data.notifyEnabled ? '🔔' : '○'}
    </button>
  );
}

// ── Audit Side Panel ──────────────────────────────────────────────────────────
function AuditPanel({ ticker, stocks }: { ticker: string | null; stocks: ProcessedStock[] }) {
  const stock = stocks.find((s) => s.ticker === ticker);

  if (!stock) {
    return (
      <aside className="side-panel">
        <div className="side-panel-header"><div className="side-panel-title">Skeptic's Audit</div></div>
        <div className="audit-empty">Click any row to view<br />the full Skeptic's Audit</div>
      </aside>
    );
  }

  const color = VERDICT_COLORS[stock.verdictType];
  const bg = VERDICT_BG[stock.verdictType];
  const changeClass = stock.change >= 0 ? 'positive' : 'negative';
  const sign = stock.change >= 0 ? '+' : '';
  const diff = stock.buyTarget - stock.stop;
  const rr = diff !== 0 ? Math.abs((stock.price - stock.buyTarget) / diff).toFixed(2) : '—';

  return (
    <aside className="side-panel">
      <div className="side-panel-header"><div className="side-panel-title">Skeptic's Audit</div></div>
      <div className="audit-content">

        <div>
          <div className="audit-ticker">{stock.ticker}</div>
          <div className="audit-name">{stock.name}</div>
          <div className="audit-name" style={{ marginTop: 2 }}>{stock.sector} · {stock.strategy}</div>
          <div className="audit-price">${stock.price.toFixed(2)}</div>
          <div className={`audit-row-value ${changeClass}`} style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            {sign}{stock.change.toFixed(2)} ({sign}{stock.changePercent.toFixed(2)}%)
          </div>
        </div>

        <div className="audit-verdict-banner" style={{ borderLeftColor: color, background: bg }}>
          <div style={{ color, fontSize: 11, fontWeight: 600, marginBottom: 3 }}>{stock.verdictType}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
            {stock.verdict.replace(`${stock.verdictType}: `, '')}
          </div>
        </div>

        <div>
          <div className="audit-section-title">Action Levels</div>
          {[
            { label: 'Buy Target', val: `$${stock.buyTarget.toFixed(2)}`, cls: 'positive' },
            { label: 'Hard Stop', val: `$${stock.stop.toFixed(2)}`, cls: 'negative' },
            { label: 'Floor (Structural)', val: `$${stock.floor.toFixed(2)}`, cls: 'danger' },
            { label: 'Risk / Reward', val: `${rr}x`, cls: '' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="audit-row">
              <span className="audit-row-label">{label}</span>
              <span className={`audit-row-value ${cls}`} style={!cls ? { color: 'var(--text-primary)' } : {}}>{val}</span>
            </div>
          ))}
        </div>

        <div>
          <div className="audit-section-title">Indicators</div>
          {[
            { label: 'RSI (14)', val: stock.indicators.rsi14.toFixed(1), cls: stock.indicators.rsi14 > 70 ? 'warning' : stock.indicators.rsi14 < 30 ? 'positive' : '' },
            { label: 'SMA 50', val: `$${stock.indicators.sma50.toFixed(2)}`, cls: '' },
            { label: 'SMA 50 Dist.', val: `${stock.indicators.smaProximityPct > 0 ? '+' : ''}${stock.indicators.smaProximityPct.toFixed(2)}%`, cls: stock.indicators.smaProximityPct >= 0 ? 'positive' : 'negative' },
            { label: 'SMA 200', val: `$${stock.indicators.sma200.toFixed(2)}`, cls: '' },
            { label: 'ATR (14)', val: `$${stock.indicators.atr14.toFixed(2)}`, cls: '' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="audit-row">
              <span className="audit-row-label">{label}</span>
              <span className={`audit-row-value ${cls}`} style={!cls ? { color: 'var(--text-primary)' } : {}}>{val}</span>
            </div>
          ))}
        </div>

        <div>
          <div className="audit-section-title">Wick Analysis (Ptil)</div>
          {[
            { label: 'Lower Wick', val: `$${stock.wick.lowerWick.toFixed(2)}`, cls: '' },
            { label: 'Upper Wick', val: `$${stock.wick.upperWick.toFixed(2)}`, cls: '' },
            { label: 'Aggressive Signal', val: stock.wick.hasAggressiveBuySignal ? 'YES — Buyers' : 'NO', cls: stock.wick.hasAggressiveBuySignal ? 'positive' : 'negative' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="audit-row">
              <span className="audit-row-label">{label}</span>
              <span className={`audit-row-value ${cls}`} style={!cls ? { color: 'var(--text-primary)' } : {}}>{val}</span>
            </div>
          ))}
        </div>

        {(stock.pattern.hasDoubleBottom || stock.pattern.hasDoubleTop) && (
          <div>
            <div className="audit-section-title">Pattern Detection</div>
            {stock.pattern.hasDoubleBottom && (
              <div className="audit-row">
                <span className="audit-row-label">Double Bottom</span>
                <span className="audit-row-value positive">${stock.pattern.patternLevel?.toFixed(2)}</span>
              </div>
            )}
            {stock.pattern.hasDoubleTop && (
              <div className="audit-row">
                <span className="audit-row-label">Double Top</span>
                <span className="audit-row-value danger">${stock.pattern.patternLevel?.toFixed(2)}</span>
              </div>
            )}
            {stock.pattern.patternDescription && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                {stock.pattern.patternDescription}
              </div>
            )}
          </div>
        )}

        <div>
          <div className="audit-section-title">Skeptic's Audit</div>
          {stock.audit.warnings.length === 0 ? (
            <div className="clean-item">No red flags detected</div>
          ) : (
            <div className="warning-list">
              {stock.audit.warnings.map((w, i) => <div key={i} className="warning-item">{w}</div>)}
            </div>
          )}
        </div>

      </div>
    </aside>
  );
}

// ── Alert Toasts ──────────────────────────────────────────────────────────────
function AlertToasts() {
  const { alerts, dismissAlert } = useTerminalStore();
  return (
    <div className="alerts-container">
      {alerts.slice(0, 4).map((alert) => (
        <div key={alert.id} className="alert-toast">
          <div className="alert-content">
            <div className="alert-label">🔔 Price Alert</div>
            <div className="alert-message">{alert.message}</div>
            <div className="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</div>
          </div>
          <button className="alert-dismiss" onClick={() => dismissAlert(alert.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stocks }: { stocks: ProcessedStock[] }) {
  const counts = useMemo(() => {
    const r: Record<VerdictType, number> = { BUY: 0, ACCUMULATE: 0, WAIT: 0, AVOID: 0, DANGER: 0 };
    stocks.forEach((s) => r[s.verdictType]++);
    return r;
  }, [stocks]);
  const alertCount = useMemo(
    () => stocks.filter((s) => s.notifyEnabled && s.price <= s.buyTarget).length,
    [stocks]
  );
  return (
    <div className="stats-bar">
      <div className="stat-item">
        <span className="stat-label">Watching</span>
        <span className="stat-value" style={{ color: 'var(--text-primary)' }}>{stocks.length}</span>
      </div>
      {(Object.entries(counts) as [VerdictType, number][]).map(([v, n]) =>
        n > 0 ? (
          <div key={v} className="stat-item">
            <span className="stat-label">{v}</span>
            <span className="stat-value" style={{ color: VERDICT_COLORS[v] }}>{n}</span>
          </div>
        ) : null
      )}
      {alertCount > 0 && (
        <div className="stat-item" style={{ marginLeft: 'auto' }}>
          <span className="stat-label">🔔 At Target</span>
          <span className="stat-value buy">{alertCount}</span>
        </div>
      )}
    </div>
  );
}

// ── Add Ticker Form ───────────────────────────────────────────────────────────
function AddTickerForm() {
  const [value, setValue] = useState('');
  const { addTicker } = useTerminalStore();
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = value.trim().toUpperCase();
    if (t.length >= 1 && t.length <= 5) { addTicker(t); setValue(''); }
  }
  return (
    <form className="add-ticker-form" onSubmit={handleSubmit}>
      <input
        className="ticker-input"
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        placeholder="e.g. AAPL"
        maxLength={5}
        spellCheck={false}
      />
      <button type="submit" className="btn-add">+ Add</button>
    </form>
  );
}

// ── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="header-time">{time}</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TerminalPage() {
  const gridApiRef = useRef<GridApi<ProcessedStock> | null>(null);
  const {
    stocks, filter, selectedTicker, isConnected, isLoading, connectionError,
    toggleSector, toggleStrategy, toggleVerdict, setSelectedTicker,
    toggleNotify, resetFilter, setFilter,
  } = useTerminalStore();

  useSignalRConnection();

  const filteredStocks = useMemo(() => stocks.filter((s) => {
    if (filter.sectors.length > 0 && !filter.sectors.includes(s.sector)) return false;
    if (filter.strategies.length > 0 && !filter.strategies.includes(s.strategy)) return false;
    if (filter.verdicts.length > 0 && !filter.verdicts.includes(s.verdictType)) return false;
    if (filter.notifyOnly && !s.notifyEnabled) return false;
    if (filter.nearBuyTargetOnly && Math.abs((s.price - s.buyTarget) / s.buyTarget) * 100 > 1.0) return false;
    return true;
  }), [stocks, filter]);

  const columnDefs = useMemo(() => getStockColumnDefs(), []);
  const defaultColDef = useMemo<ColDef<ProcessedStock>>(() => ({
    suppressMovable: false,
    wrapText: false,
    autoHeight: false,
    cellStyle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  }), []);
  const onGridReady = useCallback((e: GridReadyEvent<ProcessedStock>) => { gridApiRef.current = e.api; }, []);
  const onRowClicked = useCallback((e: { data?: ProcessedStock }) => {
    if (e.data) setSelectedTicker(e.data.ticker === selectedTicker ? null : e.data.ticker);
  }, [selectedTicker, setSelectedTicker]);
  const gridContext = useMemo(() => ({ onToggleNotify: (t: string) => toggleNotify(t) }), [toggleNotify]);

  const hasActiveFilter = filter.sectors.length > 0 || filter.strategies.length > 0 ||
    filter.verdicts.length > 0 || filter.notifyOnly || filter.nearBuyTargetOnly;

  return (
    <div className="terminal-layout">

      {/* Header */}
      <header className="terminal-header">
        <div className="terminal-logo">
          <div className="logo-mark">S</div>
          <div>
            <div className="logo-text">The Skeptic's Stock Terminal</div>
            <div className="logo-sub">Real-time Technical Analysis</div>
          </div>
        </div>
        <div className="header-status">
          <AddTickerForm />
          <div className="toolbar-divider" />
          <div className="connection-indicator">
            <div className={`connection-dot ${isConnected ? '' : 'disconnected'}`} />
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </div>
          <LiveClock />
        </div>
      </header>

      {/* Stats */}
      <StatsBar stocks={filteredStocks} />

      {/* Filters */}
      <div className="terminal-toolbar">
        <div className="toolbar-section">
          <span className="toolbar-label">Verdict</span>
          {ALL_VERDICTS.map((v) => (
            <button key={v} className={`filter-chip verdict-${v} ${filter.verdicts.includes(v) ? 'active' : ''}`} onClick={() => toggleVerdict(v)}>{v}</button>
          ))}
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-section">
          <span className="toolbar-label">Sector</span>
          {ALL_SECTORS.map((s) => (
            <button key={s} className={`filter-chip ${filter.sectors.includes(s) ? 'active' : ''}`} onClick={() => toggleSector(s)}>{s}</button>
          ))}
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-section">
          <span className="toolbar-label">Strategy</span>
          {ALL_STRATEGIES.map((s) => (
            <button key={s} className={`filter-chip ${filter.strategies.includes(s) ? 'active' : ''}`} onClick={() => toggleStrategy(s)}>{s}</button>
          ))}
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-section">
          <button className={`filter-chip ${filter.notifyOnly ? 'active' : ''}`} onClick={() => setFilter({ notifyOnly: !filter.notifyOnly })}>🔔 Notify Only</button>
          <button className={`filter-chip ${filter.nearBuyTargetOnly ? 'active' : ''}`} onClick={() => setFilter({ nearBuyTargetOnly: !filter.nearBuyTargetOnly })}>⚡ Near Target</button>
        </div>
        {hasActiveFilter && (<><div className="toolbar-divider" /><button className="btn-reset" onClick={resetFilter}>✕ Reset</button></>)}
      </div>

      {/* Body */}
      <div className="terminal-body">
        <div className="grid-container">
          {isLoading ? (
            <div className="loading-overlay"><div className="spinner" />Connecting to data stream...</div>
          ) : stocks.length === 0 && !isConnected && connectionError ? (
            <div className="loading-overlay" style={{ flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                ⚡ No connection to server
              </span>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                Retrying in 30 seconds...
              </span>
            </div>
          ) : (
            <div className="ag-theme-terminal ag-theme-alpine-dark" style={{ height: '100%', width: '100%' }}>
              <AgGridReact<ProcessedStock>
                rowData={filteredStocks}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                onGridReady={onGridReady}
                onRowClicked={onRowClicked}
                getRowId={(p) => p.data.ticker}
                rowHeight={48}
                animateRows={true}
                context={gridContext}
                components={{ notifyCellRenderer: NotifyCellRenderer }}
                rowSelection={'single' as const}
              />
            </div>
          )}
        </div>
        <AuditPanel ticker={selectedTicker} stocks={stocks} />
      </div>

      <AlertToasts />
    </div>
  );
}
