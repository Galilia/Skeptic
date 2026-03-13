import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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

// ── Constants ─────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 80;

const VERDICT_GRADIENTS: Record<VerdictType, string> = {
  BUY:        'linear-gradient(180deg, #041a0d 0%, #0a0c0f 65%)',
  ACCUMULATE: 'linear-gradient(180deg, #04091f 0%, #0a0c0f 65%)',
  WAIT:       'linear-gradient(180deg, #1a1100 0%, #0a0c0f 65%)',
  AVOID:      'linear-gradient(180deg, #1a0900 0%, #0a0c0f 65%)',
  DANGER:     'linear-gradient(180deg, #1a0404 0%, #0a0c0f 65%)',
};

// ── Price Orb ─────────────────────────────────────────────────────────────────

function PriceOrb({ price, sma50 }: { price: number; sma50: number }) {
  const above = price >= sma50;
  const color = above ? '#00d4aa' : '#ef5350';
  const glow  = above
    ? '0 0 28px rgba(0,212,170,0.4), 0 0 56px rgba(0,212,170,0.15)'
    : '0 0 28px rgba(239,83,80,0.4), 0 0 56px rgba(239,83,80,0.15)';

  return (
    <div style={{
      width: 164,
      height: 164,
      borderRadius: '50%',
      border: `2px solid ${color}`,
      boxShadow: glow,
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
        ${price.toFixed(2)}
      </span>
      <span style={{ fontSize: 10, color: above ? '#00d4aa88' : '#ef535088', fontFamily: 'IBM Plex Mono, monospace' }}>
        {above ? '▲ above SMA50' : '▼ below SMA50'}
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
}>(function StockCard({ stock, onSwipeLeft, onSwipeRight }, ref) {
  const controls = useAnimation();
  const x        = useMotionValue(0);

  // Entry animation on mount
  useEffect(() => {
    controls.start({ opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 26 } });
  }, [controls]);

  const rotate       = useTransform(x, [-220, 220], [-13, 13]);
  const skipOpacity  = useTransform(x, [-100, -30], [1, 0]);
  const saveOpacity  = useTransform(x, [30, 100], [0, 1]);

  const verdictType  = stock.verdictType as VerdictType;
  const verdictColor = VERDICT_COLORS[verdictType];

  const aboveSma50  = stock.price >= stock.indicators.sma50;
  const aboveSma200 = stock.price >= stock.indicators.sma200;
  const rsi         = stock.indicators.rsi14;
  const rsiColor    = rsi < 50 ? '#00d4aa' : rsi < 70 ? '#ffb300' : '#ef5350';
  const smaPct      = stock.indicators.smaProximityPct;
  const changeSign  = stock.change >= 0 ? '+' : '';
  const changeColor = stock.change >= 0 ? '#00d4aa' : '#ef5350';

  const animateLeft = async () => {
    await controls.start({ x: -640, opacity: 0, rotate: -22, transition: { duration: 0.26, ease: 'easeIn' } });
    onSwipeLeft();
  };

  const animateRight = async () => {
    await controls.start({ x: 640, opacity: 0, rotate: 22, transition: { duration: 0.26, ease: 'easeIn' } });
    onSwipeRight();
  };

  const handleDragEnd = async (_: PointerEvent, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD)       await animateRight();
    else if (info.offset.x < -SWIPE_THRESHOLD) await animateLeft();
    else controls.start({ x: 0, rotate: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } });
  };

  // Expose swipe triggers so the external pill buttons can use them
  useImperativeHandle(ref, () => ({
    triggerSwipeLeft:  animateLeft,
    triggerSwipeRight: animateRight,
  }));

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
        background: VERDICT_GRADIENTS[verdictType],
        border: '1px solid #1e2535',
        overflow: 'hidden',
        cursor: 'grab',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // Extra bottom padding so content clears the action buttons
        padding: '20px 20px 148px',
        gap: 14,
        touchAction: 'none',
        overflowY: 'auto',
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
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

      {/* Ticker + company header */}
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em' }}>
          {stock.ticker}
        </div>
        <div style={{ fontSize: 12, color: '#8a93a8', fontFamily: 'IBM Plex Sans, sans-serif', marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {stock.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ padding: '2px 8px', borderRadius: 4, background: '#161b24', border: '1px solid #252d40', fontSize: 10, color: '#8a93a8', fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {stock.sector}
          </span>
          <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: changeColor }}>
            {changeSign}{stock.changePercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Price Orb */}
      <PriceOrb price={stock.price} sma50={stock.indicators.sma50} />

      {/* Mini Orbs */}
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
        <MiniOrb label="Buy Target" value={stock.buyTarget} color="#00d4aa" />
        <MiniOrb label="Hard Stop"  value={stock.stop}      color="#ff7043" />
        <MiniOrb label="Floor"      value={stock.floor}     color="#ef5350" />
      </div>

      {/* Indicator badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
        <PillBadge
          label={`SMA50 ${aboveSma50 ? '▲' : '▼'} ${smaPct > 0 ? '+' : ''}${smaPct.toFixed(1)}%`}
          color={aboveSma50 ? '#00d4aa' : '#ef5350'}
          bg={aboveSma50 ? 'rgba(0,212,170,0.08)' : 'rgba(239,83,80,0.08)'}
        />
        <PillBadge
          label={`SMA200 ${aboveSma200 ? '▲' : '▼'}`}
          color={aboveSma200 ? '#00d4aa' : '#ef5350'}
          bg={aboveSma200 ? 'rgba(0,212,170,0.08)' : 'rgba(239,83,80,0.08)'}
        />
        <PillBadge
          label={`RSI ${rsi.toFixed(1)}`}
          color={rsiColor}
          bg={`${rsiColor}18`}
        />
        {stock.wick.hasAggressiveBuySignal && (
          <PillBadge label="🔥 Wick Signal" color="#00d4aa" bg="rgba(0,212,170,0.1)" />
        )}
      </div>

      {/* Verdict block */}
      <div style={{ width: '100%', padding: '11px 14px', borderRadius: 10, borderLeft: `3px solid ${verdictColor}`, background: `${verdictColor}14` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: verdictColor, fontFamily: 'IBM Plex Sans, sans-serif', letterSpacing: '0.08em', marginBottom: 5 }}>
          {stock.verdictType}
        </div>
        <div style={{ fontSize: 13, color: '#8a93a8', fontFamily: 'IBM Plex Sans, sans-serif', lineHeight: 1.55 }}>
          {stock.verdict.replace(`${stock.verdictType}: `, '')}
        </div>
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

  const { stocks, isLoading } = useTerminalStore();
  const [index, setIndex]     = useState(0);
  const [saved, setSaved]     = useState<Set<string>>(new Set());
  const [showSaved, setShowSaved] = useState(false);

  // Ref to imperatively trigger card swipe animations from the pill buttons
  const cardRef = useRef<CardHandle>(null);

  const handleSwipeLeft  = () => setIndex((i) => i + 1);
  const handleSwipeRight = () => {
    if (stocks[index]) setSaved((prev) => new Set([...prev, stocks[index].ticker]));
    setIndex((i) => i + 1);
  };

  const reset = () => { setIndex(0); setSaved(new Set()); setShowSaved(false); };

  // Loading state
  if (isLoading || stocks.length === 0) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100dvh',
        margin: 0, padding: 0, overflow: 'hidden',
        background: '#0a0c0f',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
      }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid #1e2535', borderTopColor: '#00d4aa', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#4a5268', fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Connecting to data stream...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isDone   = index >= stocks.length;
  const progress = Math.min((index / stocks.length) * 100, 100);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      margin: 0,
      padding: 0,
      width: '100vw',
      height: '100dvh',
      overflow: 'hidden',
      background: '#0a0c0f',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid #1e2535',
        background: '#0f1218',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 4, background: '#00d4aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#000', fontFamily: 'IBM Plex Mono, monospace' }}>
            S
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>Stock Swiper</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved.size > 0 && (
            <button
              onClick={() => setShowSaved((v) => !v)}
              style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 6, color: '#00d4aa', fontSize: 11, padding: '4px 10px', cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              🔖 {saved.size}
            </button>
          )}
          <span style={{ fontSize: 11, color: '#4a5268', fontFamily: 'IBM Plex Mono, monospace' }}>
            {isDone ? stocks.length : index + 1}/{stocks.length}
          </span>
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
          <SavedOverlay saved={saved} stocks={stocks} onClose={() => setShowSaved(false)} />
        )}
      </AnimatePresence>

      {/* Card stack — fills all remaining space, no padding */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
      }}>
        {isDone ? (
          <DoneScreen total={stocks.length} savedCount={saved.size} onReset={reset} />
        ) : (
          <>
            {/* Peek card — decorative, no interaction */}
            {stocks[index + 1] && (
              <div style={{
                position: 'absolute',
                top: 10, right: 10, bottom: 10, left: 10,
                borderRadius: 16,
                background: VERDICT_GRADIENTS[stocks[index + 1].verdictType as VerdictType],
                border: '1px solid #1a2030',
                transform: 'scale(0.94)',
                opacity: 0.45,
              }} />
            )}

            {/* Active card — key forces full remount on each new stock */}
            <StockCard
              ref={cardRef}
              key={index}
              stock={stocks[index]}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
            />

            {/* Action buttons — fixed at bottom, outside the draggable card */}
            <div style={{
              position: 'absolute',
              bottom: 48,
              left: 0,
              right: 0,
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
                  height: 56,
                  minWidth: 140,
                  background: '#ef5350',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 18,
                  border: 'none',
                  borderRadius: 50,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  letterSpacing: '0.04em',
                }}
              >
                SKIP
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => cardRef.current?.triggerSwipeRight()}
                style={{
                  pointerEvents: 'auto',
                  height: 56,
                  minWidth: 140,
                  background: '#00d4aa',
                  color: '#000000',
                  fontWeight: 700,
                  fontSize: 18,
                  border: 'none',
                  borderRadius: 50,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  letterSpacing: '0.04em',
                }}
              >
                SAVE 🔖
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
