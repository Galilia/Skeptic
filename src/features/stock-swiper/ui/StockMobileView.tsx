import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimation,
  AnimatePresence,
  type PanInfo,
} from 'framer-motion';

import { useTerminalStore } from '@/shared/model/terminal-store';
import { useSignalRConnection } from '@/shared/lib/use-signalr-connection';
import type { ProcessedStock, VerdictType } from '@/entities/stock';
import { VERDICT_COLORS } from '@/entities/stock';
import { useUserSettings } from '@/features/user-settings/model/use-user-settings';
import UserSettingsSheet from '@/features/user-settings/ui/UserSettings';

// ── Constants ─────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 80;
const SWIPE_UP_THRESHOLD = 80;

// Decorative peek-card gradients (unchanged)
const VERDICT_GRADIENTS: Record<VerdictType, string> = {
  BUY:        'linear-gradient(180deg, #041a0d 0%, #0a0c0f 65%)',
  ACCUMULATE: 'linear-gradient(180deg, #04091f 0%, #0a0c0f 65%)',
  WAIT:       'linear-gradient(180deg, #1a1100 0%, #0a0c0f 65%)',
  AVOID:      'linear-gradient(180deg, #1a0900 0%, #0a0c0f 65%)',
  DANGER:     'linear-gradient(180deg, #1a0404 0%, #0a0c0f 65%)',
};

// ── Signal helpers ─────────────────────────────────────────────────────────────

function isStrongEntry(stock: ProcessedStock) {
  return stock.verdictType === 'BUY' &&
    stock.trendAligned &&
    stock.volumeConfirmed &&
    stock.nearBuyTarget;
}

function getPriceOrbColor(stock: ProcessedStock): string {
  const { verdictType, trendAligned, volumeConfirmed, nearStop } = stock;
  if (nearStop) return '#ef5350';
  if (verdictType === 'DANGER') return '#e53935';
  if (verdictType === 'AVOID') return '#ff7043';
  if (verdictType === 'WAIT') return '#ffb300';
  if (verdictType === 'BUY' && trendAligned && volumeConfirmed) return '#00e676';
  if (verdictType === 'BUY') return '#00d4aa';
  if (verdictType === 'ACCUMULATE') return '#4fc3f7';
  return '#ffb300';
}

function getPriceOrbAnimation(stock: ProcessedStock): string {
  if (stock.nearStop) return 'dangerPulse 0.8s ease-in-out infinite';
  if (isStrongEntry(stock)) return 'entryGlow 1.5s ease-in-out infinite';
  if (stock.verdictType === 'WAIT') return 'neutralPulse 3s ease-in-out infinite';
  return 'none';
}

function getCardBackground(stock: ProcessedStock): string {
  if (stock.verdictType === 'BUY' && stock.trendAligned && stock.volumeConfirmed)
    return 'radial-gradient(ellipse at 50% 20%, #003d2e 0%, #000a06 100%)';
  if (stock.verdictType === 'BUY')
    return 'radial-gradient(ellipse at 50% 20%, #002e1a 0%, #000a06 100%)';
  if (stock.verdictType === 'ACCUMULATE')
    return 'radial-gradient(ellipse at 50% 20%, #001a3d 0%, #000810 100%)';
  if (stock.verdictType === 'WAIT')
    return 'radial-gradient(ellipse at 50% 20%, #2d2400 0%, #0a0800 100%)';
  if (stock.verdictType === 'AVOID')
    return 'radial-gradient(ellipse at 50% 20%, #3d1500 0%, #0d0500 100%)';
  if (stock.verdictType === 'DANGER')
    return 'radial-gradient(ellipse at 50% 20%, #3d0000 0%, #0d0000 100%)';
  return 'radial-gradient(ellipse at 50% 20%, #2d2400 0%, #0a0800 100%)';
}

/** Score a stock 0–100 for card ordering (best opportunities first) */
function scoreStock(stock: ProcessedStock): number {
  let score = 0;
  if (stock.verdictType === 'BUY')        score += 30;
  if (stock.verdictType === 'ACCUMULATE') score += 20;
  if (stock.trendAligned)                 score += 15;
  if (stock.volumeConfirmed)              score += 10;
  if (stock.nearBuyTarget)                score += 10;
  if (stock.priceOnSma150 || stock.priceOnSma200) score += 10;
  if (stock.verdictType === 'DANGER')     score -= 30;
  if (stock.verdictType === 'AVOID')      score -= 20;
  if (stock.nearStop)                     score -= 10;
  return score;
}

// ── Keyframe animations ────────────────────────────────────────────────────────

function MobileAnimationStyles() {
  return (
    <style>{`
      @keyframes entryGlow {
        0%,100% { box-shadow: 0 0 20px rgba(0,230,118,0.4), 0 0 60px rgba(0,230,118,0.2) }
        50%     { box-shadow: 0 0 50px rgba(0,230,118,0.9), 0 0 100px rgba(0,230,118,0.5) }
      }
      @keyframes neutralPulse {
        0%,100% { box-shadow: 0 0 15px rgba(255,179,0,0.2) }
        50%     { box-shadow: 0 0 35px rgba(255,179,0,0.6) }
      }
      @keyframes dangerPulse {
        0%,100% { box-shadow: 0 0 20px rgba(239,83,80,0.5) }
        50%     { box-shadow: 0 0 60px rgba(239,83,80,1.0) }
      }
      @keyframes goldPulse {
        0%,100% { box-shadow: 0 0 8px rgba(255,215,0,0.2) }
        50%     { box-shadow: 0 0 20px rgba(255,215,0,0.6) }
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px; height: 14px;
        border-radius: 50%;
        background: #00d4aa;
        cursor: pointer;
      }
      input[type=range]::-moz-range-thumb {
        width: 14px; height: 14px;
        border-radius: 50%;
        background: #00d4aa;
        border: none;
        cursor: pointer;
      }
    `}</style>
  );
}

// ── Price Orb ─────────────────────────────────────────────────────────────────

function PriceOrb({ stock }: { stock: ProcessedStock }) {
  const color = getPriceOrbColor(stock);
  const animation = getPriceOrbAnimation(stock);
  const aboveSma50 = stock.price >= (stock.indicators?.sma50 ?? 0);

  return (
    <div style={{
      width: 164,
      height: 164,
      borderRadius: '50%',
      border: `2px solid ${color}`,
      animation,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`,
      gap: 3,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 10, color: '#4a5268', fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Price
      </span>
      <span style={{ fontSize: 28, fontWeight: 600, color, fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1 }}>
        ${stock.price.toFixed(2)}
      </span>
      <span style={{ fontSize: 10, color: `${color}88`, fontFamily: 'IBM Plex Mono, monospace' }}>
        {aboveSma50 ? '▲ above SMA50' : '▼ below SMA50'}
      </span>
    </div>
  );
}

// ── Mini Orb ──────────────────────────────────────────────────────────────────

function MiniOrb({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 74,
        height: 74,
        borderRadius: '50%',
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 14px ${color}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${color}0d`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color, fontFamily: 'IBM Plex Mono, monospace', textAlign: 'center', padding: '0 4px' }}>
          ${value.toFixed(2)}
        </span>
      </div>
      <span style={{ fontSize: 9, color: '#4a5268', fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>
        {label}
      </span>
    </div>
  );
}

// ── Pill Badge ────────────────────────────────────────────────────────────────

function PillBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      padding: '4px 11px',
      borderRadius: 20,
      border: `1px solid ${color}`,
      background: bg,
      color,
      fontSize: 11,
      fontFamily: 'IBM Plex Mono, monospace',
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── SMA Pills Row ─────────────────────────────────────────────────────────────

function SmaPillsRow({ stock }: { stock: ProcessedStock }) {
  const { price, indicators } = stock;
  const pills = [
    { label: 'SMA20',  value: indicators.sma20,  crown: false },
    { label: 'SMA50',  value: indicators.sma50,  crown: false },
    { label: 'SMA150', value: indicators.sma150, crown: stock.priceOnSma150 },
    { label: 'SMA200', value: indicators.sma200, crown: stock.priceOnSma200 },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
      {pills.map(({ label, value, crown }) => {
        const above = price >= value;
        const color = above ? '#00d4aa' : '#ef5350';
        return (
          <span key={label} style={{
            padding: '3px 10px', borderRadius: 16,
            border: `1px solid ${color}`,
            background: `${color}15`,
            color, fontSize: 11,
            fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500,
            whiteSpace: 'nowrap',
          }}>
            {crown ? '👑 ' : ''}{label} {above ? '▲' : '▼'}
          </span>
        );
      })}
    </div>
  );
}

// ── Key SMA Badge ─────────────────────────────────────────────────────────────

function KeySmaBadge({ priceOnSma200, priceOnSma150 }: { priceOnSma200: boolean; priceOnSma150: boolean }) {
  const label = priceOnSma200
    ? '📌 ON SMA200 — Strong Support'
    : '📌 ON SMA150 — Key Level';
  return (
    <div style={{
      alignSelf: 'center',
      padding: '3px 10px', borderRadius: 6,
      border: '1px solid #ffd70060',
      color: '#ffd700aa',
      fontSize: 10, fontWeight: 600,
      fontFamily: 'IBM Plex Sans, sans-serif',
      letterSpacing: '0.06em',
    }}>
      {label}
    </div>
  );
}

// ── Touch Dots ────────────────────────────────────────────────────────────────

function TouchDots({ touches }: { touches: number }) {
  const color = touches >= 6 ? '#00e676' : touches >= 4 ? '#00d4aa' : '#ffb300';
  const bold  = touches >= 6;
  return (
    <span style={{ color, fontWeight: bold ? 700 : 400, fontSize: 9, letterSpacing: 1 }}>
      {'●'.repeat(Math.min(touches, 6))}
    </span>
  );
}

// ── Resistance / Support Row ──────────────────────────────────────────────────

function ResistanceSupportRow({ stock }: { stock: ProcessedStock }) {
  const nearestResistance = stock.resistanceLevels[0] ?? null;
  const nearestSupport    = stock.supportLevels[stock.supportLevels.length - 1] ?? null;
  if (!nearestResistance && !nearestSupport) return null;

  const resPct = nearestResistance
    ? ((nearestResistance.price - stock.price) / stock.price * 100).toFixed(1)
    : null;
  const supPct = nearestSupport
    ? ((stock.price - nearestSupport.price) / stock.price * 100).toFixed(1)
    : null;

  return (
    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
      {nearestResistance && (
        <div style={{
          flex: 1, padding: '5px 8px', borderRadius: 7,
          background: 'rgba(239,83,80,0.07)', border: '1px solid rgba(239,83,80,0.25)',
        }}>
          <div style={{ fontSize: 8, color: '#4a5268', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            ⬆ Ceiling
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#ef5350', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>
              ${nearestResistance.price.toFixed(2)}
            </span>
            <span style={{ fontSize: 9, color: '#ef535080', fontFamily: 'IBM Plex Mono, monospace' }}>
              +{resPct}%
            </span>
            <TouchDots touches={nearestResistance.touches} />
          </div>
        </div>
      )}
      {nearestSupport && (
        <div style={{
          flex: 1, padding: '5px 8px', borderRadius: 7,
          background: 'rgba(0,212,170,0.07)', border: '1px solid rgba(0,212,170,0.25)',
        }}>
          <div style={{ fontSize: 8, color: '#4a5268', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2, fontFamily: 'IBM Plex Sans, sans-serif' }}>
            ⬇ Support
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#00d4aa', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>
              ${nearestSupport.price.toFixed(2)}
            </span>
            <span style={{ fontSize: 9, color: '#00d4aa80', fontFamily: 'IBM Plex Mono, monospace' }}>
              -{supPct}%
            </span>
            <TouchDots touches={nearestSupport.touches} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Price Ladder (Chart tab) ──────────────────────────────────────────────────

function PriceLadder({ stock }: { stock: ProcessedStock }) {
  const ind = stock.indicators;
  // Chart shows only structural levels — no S/R (shown on main card)
  type LadderRow = { label: string; price: number; color: string; isCurrent?: boolean };
  const rows: LadderRow[] = [
    { label: 'SMA 200',    price: ind.sma200,       color: '#8a93a8' },
    { label: 'SMA 150',    price: ind.sma150,       color: '#8a93a8' },
    { label: 'SMA 50',     price: ind.sma50,        color: '#4fc3f7' },
    { label: 'SMA 20',     price: ind.sma20,        color: '#7986cb' },
    { label: '◆ Price',    price: stock.price,      color: '#e8eaf0', isCurrent: true },
    { label: 'Buy Target', price: stock.buyTarget,  color: '#00d4aa' },
    { label: 'Hard Stop',  price: stock.stop,       color: '#ff7043' },
    { label: 'Floor',      price: stock.floor,      color: '#ef5350' },
  ].filter((r) => r.price > 0);

  // Sort descending by price
  rows.sort((a, b) => b.price - a.price);

  // Min/max for bar scaling
  const prices = rows.map((r) => r.price);
  const hi = prices[0];
  const lo = prices[prices.length - 1];
  const range = hi - lo || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {rows.map((row, i) => {
        const pct = ((row.price - lo) / range) * 100;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 70, fontSize: 8, color: '#4a5268', fontFamily: 'IBM Plex Sans, sans-serif', textAlign: 'right', flexShrink: 0, letterSpacing: '0.04em' }}>
              {row.label}
            </div>
            <div style={{ flex: 1, position: 'relative', height: row.isCurrent ? 16 : 10 }}>
              <div style={{
                position: 'absolute',
                right: 0,
                width: `${pct}%`,
                minWidth: 2,
                height: '100%',
                background: row.isCurrent ? row.color : `${row.color}55`,
                borderRadius: 2,
              }} />
            </div>
            <div style={{ width: 60, fontSize: row.isCurrent ? 11 : 10, color: row.color, fontFamily: 'IBM Plex Mono, monospace', fontWeight: row.isCurrent ? 700 : 400, flexShrink: 0 }}>
              ${row.price.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Audit Overlay ─────────────────────────────────────────────────────────────

function AuditOverlay({
  stock,
  auditOpen,
  onClose,
}: {
  stock: ProcessedStock | null;
  auditOpen: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'chart' | 'audit'>('chart');

  // Reset tab to chart each time overlay opens
  useEffect(() => {
    if (auditOpen) setActiveTab('chart');
  }, [auditOpen]);

  const ind = stock?.indicators;
  const rsiColor = !ind ? '#4a5268' : ind.rsi14 < 50 ? '#00d4aa' : ind.rsi14 < 70 ? '#ffb300' : '#ef5350';
  const peColor = !stock || stock.peRatio === null
    ? '#4a5268'
    : stock.peRatio < 15  ? '#00d4aa'
    : stock.peRatio < 25  ? '#ffb300'
    : '#ef5350';

  return (
    <motion.div
      animate={{ y: auditOpen && stock ? 0 : '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      onPointerDown={(e) => { if (auditOpen) e.stopPropagation(); }}
      style={{
        position: 'absolute',
        inset: 0,
        background: '#090b0e',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: auditOpen && stock ? 'all' : 'none',
      }}
    >
      {/* Draggable handle — swipe down > 80px to close */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.35 }}
        onDragEnd={(_, info) => { if (info.offset.y > 80) onClose(); }}
        style={{ touchAction: 'none', flexShrink: 0, padding: '10px 0 6px', cursor: 'grab' }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2e3a50', margin: '0 auto' }} />
      </motion.div>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 18px 10px', flexShrink: 0 }}>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: '1px solid #252d40', borderRadius: 6,
            color: '#8a93a8', fontSize: 12, padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'IBM Plex Sans, sans-serif',
          }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#4a5268', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'IBM Plex Sans, sans-serif' }}>
          {stock?.ticker}
        </span>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, padding: '0 18px', flexShrink: 0, borderBottom: '1px solid #1a2030', marginBottom: 4 }}>
        {(['chart', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '8px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #00d4aa' : '2px solid transparent',
              color: activeTab === tab ? '#00d4aa' : '#4a5268',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'IBM Plex Sans, sans-serif',
              letterSpacing: '0.06em',
              transition: 'color 0.15s',
            }}
          >
            {tab === 'chart' ? '📊 Chart' : '📋 Audit'}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 80px', touchAction: 'pan-y' }}>
        {stock && ind && activeTab === 'chart' && (
          <>
            <AuditSection title="Price Ladder">
              <PriceLadder stock={stock} />
            </AuditSection>
            {stock.riskRewardRatio > 0 && (
              <AuditSection title="Risk / Reward">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: stock.riskRewardRatio >= 2 ? '#00d4aa' : '#ffb300' }}>
                    {stock.riskRewardRatio.toFixed(2)}x
                  </span>
                  <span style={{ fontSize: 11, color: '#4a5268', fontFamily: 'IBM Plex Sans, sans-serif' }}>reward-to-risk</span>
                </div>
              </AuditSection>
            )}
            <AuditSection title="Stop Detail">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <AuditStat label="Hard Stop"    value={`$${stock.stop.toFixed(2)}`}                 color="#ff7043" />
                <AuditStat label="ATR × Mult"  value={`${ind.atr14.toFixed(2)} × ${stock.stopAtrMultiplier}x`} color="#8a93a8" />
                <AuditStat label="Floor"        value={`$${stock.floor.toFixed(2)}`}                color="#ef5350" />
                <AuditStat label="Buy Target"   value={`$${stock.buyTarget.toFixed(2)}`}            color="#00d4aa" />
              </div>
            </AuditSection>
          </>
        )}

        {stock && ind && activeTab === 'audit' && (
          <>
            {/* 🚩 Red Flags — at top, always shown */}
            <AuditSection title="🚩 Reasons Not to Trade">
              {stock.redFlags.length === 0 ? (
                <div style={{ fontSize: 12, color: '#00d4aa', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  ✅ No red flags — clean setup
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {stock.redFlags.map((flag, i) => (
                    <div key={i} style={{
                      padding: '6px 10px', borderRadius: 6,
                      background: 'rgba(229,57,53,0.15)',
                      border: '1px solid rgba(229,57,53,0.3)',
                      color: '#ef5350',
                      fontSize: 11, fontFamily: 'IBM Plex Sans, sans-serif', lineHeight: 1.4,
                    }}>
                      ⚠ {flag}
                    </div>
                  ))}
                </div>
              )}
            </AuditSection>

            {/* Analyst consensus */}
            {stock.analystConsensus && stock.analystConsensus !== 'N/A' && (
              <AuditSection title="Analyst Consensus">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'IBM Plex Sans, sans-serif', color: stock.analystConsensus.includes('Buy') ? '#00d4aa' : stock.analystConsensus === 'Hold' ? '#ffb300' : '#ef5350' }}>
                    {stock.analystConsensus}
                  </span>
                  {stock.analystCount > 0 && (
                    <span style={{ fontSize: 11, color: '#4a5268', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      ({stock.analystCount} analysts)
                    </span>
                  )}
                </div>
              </AuditSection>
            )}

            {/* Valuation */}
            <AuditSection title="Valuation">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <AuditStat label="P/E Ratio" value={stock.peRatio !== null ? stock.peRatio.toFixed(1) : 'N/A'} color={peColor} />
                <AuditStat label="RSI 14"    value={ind.rsi14.toFixed(1)}       color={rsiColor} />
                <AuditStat label="ATR 14"    value={`$${ind.atr14.toFixed(2)}`} color="#8a93a8" />
                <AuditStat label="SMA Dist"  value={`${ind.smaProximityPct > 0 ? '+' : ''}${ind.smaProximityPct.toFixed(1)}%`} color={Math.abs(ind.smaProximityPct) > 12 ? '#ef5350' : '#8a93a8'} />
              </div>
            </AuditSection>

            {/* Trends */}
            <AuditSection title="Trend">
              <div style={{ display: 'flex', gap: 10 }}>
                <TrendBadge label="Short"   trend={stock.shortTrend} />
                <TrendBadge label="Long"    trend={stock.longTrend} />
                <TrendBadge label="Aligned" trend={stock.trendAligned ? 'UP' : 'DOWN'} customLabel={stock.trendAligned ? 'YES' : 'NO'} />
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <TrendBadge
                  label={`${stock.sectorEtfTicker || stock.sector.slice(0, 4)}`}
                  trend={stock.sectorTrend}
                  customLabel={`${stock.sectorChangePercent > 0 ? '+' : ''}${stock.sectorChangePercent.toFixed(1)}%`}
                />
              </div>
            </AuditSection>

            {/* Pattern */}
            {(stock.pattern.hasDoubleBottom || stock.pattern.hasDoubleTop) && (
              <AuditSection title="Pattern">
                <div style={{ fontSize: 13, color: stock.pattern.hasDoubleBottom ? '#00d4aa' : '#ef5350', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 600, marginBottom: 4 }}>
                  {stock.pattern.hasDoubleBottom ? '📐 Double Bottom' : '📐 Double Top'}
                </div>
                {stock.pattern.patternDescription && (
                  <div style={{ fontSize: 11, color: '#4a5268', fontFamily: 'IBM Plex Sans, sans-serif', lineHeight: 1.5 }}>
                    {stock.pattern.patternDescription}
                  </div>
                )}
              </AuditSection>
            )}

            {/* Fibonacci levels — S/R removed (shown on main card only) */}
            {stock.fibLevels.length > 0 && (
              <AuditSection title="Fibonacci Retracement">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {stock.fibLevels.map((f) => {
                    const isNearest = stock.nearFibLevel?.label === f.label;
                    const color = isNearest ? '#ffd700' : '#4a5268';
                    return (
                      <div key={f.label} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: isNearest ? '4px 6px' : '0',
                        borderRadius: 4,
                        background: isNearest ? 'rgba(255,215,0,0.08)' : 'transparent',
                      }}>
                        <span style={{ fontSize: 11, color, fontFamily: 'IBM Plex Mono, monospace' }}>
                          {isNearest ? '▶ ' : '  '}{f.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isNearest && stock.nearFibLevel && (
                            <span style={{ fontSize: 9, color: '#ffd70080', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                              ← you are here ({stock.nearFibLevel.distance.toFixed(1)}%)
                            </span>
                          )}
                          <span style={{ fontSize: 11, color, fontFamily: 'IBM Plex Mono, monospace', fontWeight: isNearest ? 600 : 400 }}>
                            ${f.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AuditSection>
            )}

            {/* Stop detail */}
            <AuditSection title="Stop Detail">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <AuditStat label="Hard Stop"  value={`$${stock.stop.toFixed(2)}`}                          color="#ff7043" />
                <AuditStat label="ATR × Mult" value={`${ind.atr14.toFixed(2)} × ${stock.stopAtrMultiplier}x`} color="#8a93a8" />
              </div>
            </AuditSection>
          </>
        )}
      </div>
    </motion.div>
  );
}

function AuditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: '#4a5268',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: 8, fontFamily: 'IBM Plex Sans, sans-serif',
      }}>
        {title}
      </div>
      {children}
      <div style={{ height: 1, background: '#1a2030', marginTop: 12 }} />
    </div>
  );
}

function AuditStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '6px 8px', background: '#0f1218', borderRadius: 6, border: '1px solid #1e2535' }}>
      <div style={{ fontSize: 9, color: '#4a5268', fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

function TrendBadge({ label, trend, customLabel }: { label: string; trend: string; customLabel?: string }) {
  const color = trend === 'UP' ? '#00d4aa' : trend === 'DOWN' ? '#ef5350' : '#ffb300';
  const display = customLabel ?? trend;
  return (
    <div style={{
      padding: '5px 10px', borderRadius: 8,
      border: `1px solid ${color}40`,
      background: `${color}12`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, color: '#4a5268', fontFamily: 'IBM Plex Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>
        {display}
      </div>
    </div>
  );
}

// ── Fear & Greed helpers ──────────────────────────────────────────────────────

function fgColor(value: number): string {
  if (value <= 25) return '#e53935';
  if (value <= 45) return '#ff7043';
  if (value <= 55) return '#ffb300';
  if (value <= 75) return '#66bb6a';
  return '#00d4aa';
}

/** Compact inline F&G bar for header (120px wide, 6px tall) */
function FearGreedBar({ value, label }: { value: number; label: string }) {
  const fg = fgColor(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, color: fg, fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.04em' }}>
          {label} <span style={{ color: '#4a5268', fontSize: 8 }}>(Alt.me)</span>
        </span>
        <span style={{ fontSize: 9, color: fg, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700 }}>
          {value}
        </span>
      </div>
      <div style={{ width: 120, height: 6, background: '#1e2535', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: fg, borderRadius: 3 }} />
      </div>
    </div>
  );
}

// ── Card imperative handle ────────────────────────────────────────────────────

interface CardHandle {
  triggerSwipeLeft: () => void;
  triggerSwipeRight: () => void;
}

// ── Stock Card ────────────────────────────────────────────────────────────────

const StockCard = forwardRef<CardHandle, {
  stock: ProcessedStock;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onShowAudit: () => void;
}>(function StockCard({ stock, onSwipeLeft, onSwipeRight, onShowAudit }, ref) {
  const controls = useAnimation();
  const x        = useMotionValue(0);

  // Entry animation on mount
  useEffect(() => {
    controls.start({ opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 26 } });
  }, [controls]);

  const rotate      = useTransform(x, [-220, 220], [-13, 13]);
  const skipOpacity = useTransform(x, [-100, -30], [1, 0]);
  const saveOpacity = useTransform(x, [30, 100], [0, 1]);

  const verdictType  = stock.verdictType as VerdictType;
  const verdictColor = VERDICT_COLORS[verdictType];

  const rsi          = stock.indicators?.rsi14 ?? 0;
  const rsiColor     = rsi < 50 ? '#00d4aa' : rsi < 70 ? '#ffb300' : '#ef5350';
  const changeSign   = stock.change >= 0 ? '+' : '';
  const changeColor  = stock.change >= 0 ? '#00d4aa' : '#ef5350';

  const animateLeft = async () => {
    await controls.start({ x: -640, opacity: 0, rotate: -22, transition: { duration: 0.26, ease: 'easeIn' } });
    onSwipeLeft();
  };

  const animateRight = async () => {
    await controls.start({ x: 640, opacity: 0, rotate: 22, transition: { duration: 0.26, ease: 'easeIn' } });
    onSwipeRight();
  };

  const handleDragEnd = async (_: PointerEvent, info: PanInfo) => {
    const { offset } = info;
    // Vertical upward drag takes priority when it is the dominant axis
    if (Math.abs(offset.y) > Math.abs(offset.x) && offset.y < -SWIPE_UP_THRESHOLD) {
      controls.start({ x: 0, rotate: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } });
      onShowAudit();
      return;
    }
    if (offset.x > SWIPE_THRESHOLD)       await animateRight();
    else if (offset.x < -SWIPE_THRESHOLD) await animateLeft();
    else controls.start({ x: 0, rotate: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } });
  };

  useImperativeHandle(ref, () => ({
    triggerSwipeLeft:  animateLeft,
    triggerSwipeRight: animateRight,
  }));

  const onKeySma = stock.priceOnSma150 || stock.priceOnSma200;

  return (
    <motion.div
      animate={controls}
      style={{
        x,
        rotate,
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: getCardBackground(stock),
        border: '1px solid #1e2535',
        overflow: 'hidden',
        cursor: 'grab',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 20px 148px',
        gap: 14,
        touchAction: 'none',
        overflowY: 'auto',
      }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.55}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
      initial={{ opacity: 0, scale: 0.96 }}
    >
      {/* Drag direction indicators */}
      <motion.div style={{
        position: 'absolute', top: 18, left: 18,
        opacity: skipOpacity,
        padding: '5px 13px', borderRadius: 8,
        border: '2px solid #ef5350', color: '#ef5350',
        fontSize: 12, fontWeight: 700, fontFamily: 'IBM Plex Sans, sans-serif',
        letterSpacing: '0.08em', background: 'rgba(239,83,80,0.1)', pointerEvents: 'none',
      }}>
        SKIP
      </motion.div>
      <motion.div style={{
        position: 'absolute', top: 18, right: 18,
        opacity: saveOpacity,
        padding: '5px 13px', borderRadius: 8,
        border: '2px solid #00d4aa', color: '#00d4aa',
        fontSize: 12, fontWeight: 700, fontFamily: 'IBM Plex Sans, sans-serif',
        letterSpacing: '0.08em', background: 'rgba(0,212,170,0.1)', pointerEvents: 'none',
      }}>
        SAVE 🔖
      </motion.div>

      {/* Swipe-up hint */}
      <div style={{ position: 'absolute', bottom: 144, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: 9, color: '#252d40', fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          ↑ swipe up for full audit
        </span>
      </div>

      {/* Sector badge — absolute top-left: ETF ticker + arrow + % */}
      <div style={{ position: 'absolute', top: 12, left: 12, pointerEvents: 'none' }}>
        <span style={{
          fontSize: 10,
          fontFamily: 'IBM Plex Mono, monospace',
          color: stock.sectorTrend === 'UP' ? '#00d4aa' : stock.sectorTrend === 'DOWN' ? '#ef5350' : '#ffb300',
        }}>
          {stock.sectorEtfTicker || stock.sector.slice(0, 4)}
          {' '}
          {stock.sectorTrend === 'UP' ? '↑' : stock.sectorTrend === 'DOWN' ? '↓' : '→'}
          {stock.sectorChangePercent !== 0 && `${stock.sectorChangePercent > 0 ? '+' : ''}${stock.sectorChangePercent.toFixed(1)}%`}
        </span>
      </div>

      {/* Change% — absolute top-right, leaves space for SAVE label */}
      <div style={{ position: 'absolute', top: 12, right: 48, pointerEvents: 'none' }}>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: changeColor }}>
          {changeSign}{stock.changePercent.toFixed(2)}%
        </span>
      </div>

      {/* Ticker + company name — centered, no sector row */}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em' }}>
          {stock.ticker}
        </div>
        <div style={{ fontSize: 12, color: '#8a93a8', fontFamily: 'IBM Plex Sans, sans-serif', marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {stock.name}
        </div>
      </div>

      {/* Key SMA badge — only shown when price is on SMA150 or SMA200 */}
      {onKeySma && <KeySmaBadge priceOnSma200={stock.priceOnSma200} priceOnSma150={stock.priceOnSma150} />}

      {/* Price Orb */}
      <PriceOrb stock={stock} />

      {/* Mini Orbs */}
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
        <MiniOrb label="Buy Target" value={stock.buyTarget} color="#00d4aa" />
        <MiniOrb label="Hard Stop"  value={stock.stop}      color="#ff7043" />
        <MiniOrb label="Floor"      value={stock.floor}     color="#ef5350" />
      </div>

      {/* Resistance / Support row */}
      <ResistanceSupportRow stock={stock} />

      {/* SMA pills row */}
      <SmaPillsRow stock={stock} />

      {/* Indicator badges — RSI + P/E inline + signal pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
        <PillBadge
          label={`RSI ${rsi.toFixed(1)}`}
          color={rsiColor}
          bg={`${rsiColor}18`}
        />
        <PillBadge
          label={stock.peRatio !== null ? `P/E ${stock.peRatio.toFixed(1)}` : 'P/E N/A'}
          color={
            stock.peRatio === null ? '#4a5268'
            : stock.peRatio < 15   ? '#00d4aa'
            : stock.peRatio < 25   ? '#ffb300'
            : '#ef5350'
          }
          bg={
            stock.peRatio === null ? 'transparent'
            : stock.peRatio < 15   ? 'rgba(0,212,170,0.08)'
            : stock.peRatio < 25   ? 'rgba(255,179,0,0.08)'
            : 'rgba(239,83,80,0.08)'
          }
        />
        {stock.wick.hasAggressiveBuySignal && (
          <PillBadge label="🔥 Wick Signal" color="#00d4aa" bg="rgba(0,212,170,0.1)" />
        )}
        {stock.volumeConfirmed && (
          <PillBadge label="✓ Vol Confirmed" color="#4fc3f7" bg="rgba(79,195,247,0.08)" />
        )}
        {stock.trendAligned && (
          <PillBadge label="⬆ Trend Aligned" color="#00e676" bg="rgba(0,230,118,0.08)" />
        )}
      </div>

      {/* Near Fib badge — shown when price is within 1.5% of a Fibonacci level */}
      {stock.nearFibLevel?.isNear && (
        <div style={{
          alignSelf: 'center',
          padding: '3px 10px', borderRadius: 6,
          border: '1px solid rgba(255,215,0,0.4)',
          background: 'rgba(255,215,0,0.08)',
          color: '#ffd700',
          fontSize: 10, fontWeight: 600,
          fontFamily: 'IBM Plex Sans, sans-serif',
          letterSpacing: '0.06em',
        }}>
          🎯 Near {stock.nearFibLevel.label} Fib (${stock.nearFibLevel.price.toFixed(2)})
        </div>
      )}

      {/* Verdict block */}
      <div style={{ width: '100%', padding: '11px 14px', borderRadius: 10, borderLeft: `3px solid ${verdictColor}`, background: `${verdictColor}14` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: verdictColor, fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.08em', marginBottom: 5 }}>
          {stock.verdictType}
        </div>
        <div style={{ fontSize: 13, color: '#8a93a8', fontFamily: 'IBM Plex Sans, sans-serif', lineHeight: 1.55 }}>
          {stock.verdict.replace(`${stock.verdictType}: `, '')}
        </div>
        {/* Pattern badge */}
        {(stock.pattern.hasDoubleBottom || stock.pattern.hasDoubleTop) && (
          <div style={{ marginTop: 7 }}>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: stock.pattern.hasDoubleBottom ? 'rgba(0,212,170,0.1)' : 'rgba(239,83,80,0.1)',
              color: stock.pattern.hasDoubleBottom ? '#00d4aa' : '#ef5350',
              border: `1px solid ${stock.pattern.hasDoubleBottom ? 'rgba(0,212,170,0.25)' : 'rgba(239,83,80,0.25)'}`,
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}>
              {stock.pattern.hasDoubleBottom ? '📐 Double Bottom' : '📐 Double Top'}
            </span>
          </div>
        )}
        {/* Analyst consensus badge */}
        {stock.analystConsensus && stock.analystConsensus !== 'N/A' && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#4a5268', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            👥 Analysts: <span style={{ color: stock.analystConsensus.includes('Buy') ? '#00d4aa' : stock.analystConsensus === 'Hold' ? '#ffb300' : '#ef5350', fontWeight: 600 }}>
              {stock.analystConsensus}
            </span>
            {stock.analystCount > 0 && ` (${stock.analystCount})`}
          </div>
        )}
        {stock.audit.warnings.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {stock.audit.warnings.map((w, i) => (
              <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,112,67,0.1)', color: '#ff7043', border: '1px solid rgba(255,112,67,0.2)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                ⚠ {w}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ── Saved Overlay ─────────────────────────────────────────────────────────────

function SavedOverlay({ saved, stocks, onClose }: { saved: Set<string>; stocks: ProcessedStock[]; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        position: 'absolute', top: 8, left: 12, right: 12, zIndex: 100,
        background: '#0f1218', border: '1px solid #252d40', borderRadius: 14,
        padding: 16, maxHeight: '55dvh', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: '#4a5268', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        Saved ({saved.size})
      </div>
      {[...saved].map((ticker) => {
        const s = stocks.find((st) => st.ticker === ticker);
        if (!s) return null;
        return (
          <div key={ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #1e2535' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', fontFamily: 'IBM Plex Mono, monospace' }}>{ticker}</span>
              <span style={{ fontSize: 11, color: '#4a5268', marginLeft: 8, fontFamily: 'IBM Plex Sans, sans-serif' }}>${s.price.toFixed(2)}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: VERDICT_COLORS[s.verdictType], fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.06em' }}>
              {s.verdictType}
            </span>
          </div>
        );
      })}
      <button
        onClick={onClose}
        style={{ marginTop: 12, width: '100%', padding: '8px', background: 'transparent', border: '1px solid #252d40', borderRadius: 7, color: '#8a93a8', fontSize: 12, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}
      >
        Close
      </button>
    </motion.div>
  );
}

// ── Done Screen ───────────────────────────────────────────────────────────────

function DoneScreen({ total, savedCount, onReset }: { total: number; savedCount: number; onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: '0 32px' }}
    >
      <div style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid #00d4aa', boxShadow: '0 0 24px rgba(0,212,170,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#00d4aa' }}>
        ✓
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#e8eaf0', fontFamily: 'IBM Plex Sans, sans-serif' }}>
        All {total} stocks reviewed
      </div>
      {savedCount > 0 && (
        <div style={{ fontSize: 13, color: '#00d4aa', fontFamily: 'IBM Plex Sans, sans-serif' }}>
          {savedCount} saved for further review
        </div>
      )}
      <button
        onClick={onReset}
        style={{ marginTop: 8, padding: '11px 32px', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 9, color: '#00d4aa', fontSize: 13, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.04em' }}
      >
        Review Again
      </button>
    </motion.div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function StockMobileView() {
  useSignalRConnection();

  const { stocks, isLoading }     = useTerminalStore();
  const { settings, update }      = useUserSettings();
  const [index, setIndex]         = useState(0);
  const [saved, setSaved]         = useState<Set<string>>(new Set());
  const [showSaved, setShowSaved] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const cardRef = useRef<CardHandle>(null);

  // Sort stocks by signal score so best opportunities appear first
  const sortedStocks = useMemo(
    () => [...stocks].sort((a, b) => scoreStock(b) - scoreStock(a)),
    [stocks]
  );

  const handleSwipeLeft = () => {
    setShowAudit(false);
    setIndex((i) => i + 1);
  };
  const handleSwipeRight = () => {
    if (sortedStocks[index]) setSaved((prev) => new Set([...prev, sortedStocks[index].ticker]));
    setShowAudit(false);
    setIndex((i) => i + 1);
  };

  const reset = () => { setIndex(0); setSaved(new Set()); setShowSaved(false); setShowAudit(false); };

  // Loading state
  if (isLoading || stocks.length === 0) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100dvh',
        background: '#0a0c0f',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
      }}>
        <MobileAnimationStyles />
        <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid #1e2535', borderTopColor: '#00d4aa', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#4a5268', fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Connecting to data stream...
        </span>
      </div>
    );
  }

  const isDone        = index >= sortedStocks.length;
  const currentStock  = sortedStocks[index];
  const progress      = Math.min((index / sortedStocks.length) * 100, 100);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0,
      margin: 0, padding: 0,
      width: '100vw', height: '100dvh',
      overflow: 'hidden',
      background: '#0a0c0f',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      <MobileAnimationStyles />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid #1e2535',
        background: '#0f1218',
        flexShrink: 0,
        zIndex: 10,
      }}>
        {/* Left: logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 4, background: '#00d4aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#000', fontFamily: 'IBM Plex Mono, monospace' }}>
            S
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#8a93a8', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            {isDone ? sortedStocks.length : index + 1}/{sortedStocks.length}
          </span>
        </div>

        {/* Center: Fear & Greed bar */}
        {currentStock && (
          <FearGreedBar value={currentStock.fearGreedValue} label={currentStock.fearGreedLabel} />
        )}

        {/* Right: saved button + gear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saved.size > 0 && (
            <button
              onClick={() => setShowSaved((v) => !v)}
              style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 6, color: '#00d4aa', fontSize: 11, padding: '3px 8px', cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              🔖 {saved.size}
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            style={{ background: 'transparent', border: '1px solid #252d40', borderRadius: 6, color: '#8a93a8', fontSize: 14, padding: '4px 8px', cursor: 'pointer', lineHeight: 1 }}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: '#1e2535', flexShrink: 0 }}>
        <motion.div
          style={{ height: '100%', background: '#00d4aa', originX: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Saved overlay */}
      <AnimatePresence>
        {showSaved && (
          <SavedOverlay saved={saved} stocks={sortedStocks} onClose={() => setShowSaved(false)} />
        )}
      </AnimatePresence>

      {/* Card stack */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'none' }}>
        {isDone ? (
          <DoneScreen total={sortedStocks.length} savedCount={saved.size} onReset={reset} />
        ) : (
          <>
            {/* Peek card — decorative */}
            {sortedStocks[index + 1] && (
              <div style={{
                position: 'absolute',
                top: 10, right: 10, bottom: 10, left: 10,
                borderRadius: 16,
                background: VERDICT_GRADIENTS[sortedStocks[index + 1].verdictType as VerdictType],
                border: '1px solid #1a2030',
                transform: 'scale(0.94)',
                opacity: 0.45,
              }} />
            )}

            {/* Active card — key forces full remount on each new stock */}
            <StockCard
              ref={cardRef}
              key={index}
              stock={currentStock}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onShowAudit={() => setShowAudit(true)}
            />

            {/* Full audit overlay — always mounted, position driven by auditOpen state */}
            <AuditOverlay
              stock={currentStock ?? null}
              auditOpen={showAudit}
              onClose={() => setShowAudit(false)}
            />

            {/* Action buttons */}
            <div style={{
              position: 'absolute',
              bottom: 48,
              left: 0, right: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 32,
              zIndex: 20,
              pointerEvents: 'none',
            }}>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => cardRef.current?.triggerSwipeLeft()}
                style={{
                  pointerEvents: 'auto',
                  height: 44, width: 110,
                  background: '#ef5350',
                  color: '#ffffff', fontWeight: 700, fontSize: 14,
                  border: 'none', borderRadius: 22,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.04em',
                }}
              >
                SKIP
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => cardRef.current?.triggerSwipeRight()}
                style={{
                  pointerEvents: 'auto',
                  height: 44, width: 110,
                  background: '#00d4aa',
                  color: '#000000', fontWeight: 700, fontSize: 14,
                  border: 'none', borderRadius: 22,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.04em',
                }}
              >
                SAVE 🔖
              </button>
            </div>
          </>
        )}
      </div>

      {/* Settings bottom sheet */}
      <AnimatePresence>
        {showSettings && (
          <UserSettingsSheet
            settings={settings}
            onUpdate={update}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
