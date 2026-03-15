import { motion } from 'framer-motion';
import type { UserSettings } from '../model/use-user-settings';

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, color: '#4a5268',
      letterSpacing: '0.12em', textTransform: 'uppercase',
      marginBottom: 10, marginTop: 4,
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      {children}
    </div>
  );
}

function Toggle({
  label, active, onToggle,
}: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '4px 0', width: '100%',
      }}
    >
      <div style={{
        width: 32, height: 18, borderRadius: 9,
        background: active ? '#00d4aa' : '#1e2535',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
        border: `1px solid ${active ? '#00d4aa' : '#252d40'}`,
      }}>
        <div style={{
          position: 'absolute',
          top: 2, left: active ? 14 : 2,
          width: 12, height: 12,
          borderRadius: '50%',
          background: active ? '#000' : '#4a5268',
          transition: 'left 0.2s',
        }} />
      </div>
      <span style={{
        fontSize: 12, color: active ? '#e8eaf0' : '#4a5268',
        fontFamily: 'IBM Plex Sans, sans-serif',
        transition: 'color 0.2s',
      }}>
        {label}
      </span>
    </button>
  );
}

function Slider({
  label, value, min, max, step, format, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5,
      }}>
        <span style={{ fontSize: 11, color: '#8a93a8', fontFamily: 'IBM Plex Sans, sans-serif' }}>
          {label}
        </span>
        <span style={{
          fontSize: 11, color: '#00d4aa', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600,
        }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%', height: 4, appearance: 'none',
          background: `linear-gradient(to right, #00d4aa ${((value - min) / (max - min)) * 100}%, #1e2535 0%)`,
          borderRadius: 2, outline: 'none', cursor: 'pointer',
        }}
      />
    </div>
  );
}

// ── Main Sheet ─────────────────────────────────────────────────────────────────

export default function UserSettingsSheet({
  settings,
  onUpdate,
  onClose,
}: {
  settings: UserSettings;
  onUpdate: (patch: Partial<UserSettings>) => void;
  onClose: () => void;
}) {
  const toggleIndicator = (key: keyof UserSettings['indicators']) => {
    onUpdate({ indicators: { ...settings.indicators, [key]: !settings.indicators[key] } });
  };

  const setThreshold = (key: keyof UserSettings['thresholds'], value: number) => {
    onUpdate({ thresholds: { ...settings.thresholds, [key]: value } });
  };

  // Compute position size from risk settings
  const riskAmount = (settings.risk.capital * settings.risk.riskPerTrade) / 100;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 80,
        }}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#0f1218',
          border: '1px solid #1e2535',
          borderBottom: 'none',
          borderRadius: '16px 16px 0 0',
          zIndex: 90,
          maxHeight: '82dvh',
          overflowY: 'auto',
          padding: '0 18px 32px',
          touchAction: 'pan-y',
        }}
      >
        {/* Handle */}
        <div style={{
          display: 'flex', justifyContent: 'center', padding: '12px 0 8px',
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#252d40' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 18,
        }}>
          <span style={{
            fontSize: 14, fontWeight: 600, color: '#e8eaf0',
            fontFamily: 'IBM Plex Sans, sans-serif',
          }}>
            ⚙ Settings
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid #252d40', borderRadius: 6,
              color: '#8a93a8', fontSize: 12, padding: '4px 10px', cursor: 'pointer',
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}
          >
            Done
          </button>
        </div>

        {/* Indicators section */}
        <SectionLabel>Indicators</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px', marginBottom: 18 }}>
          <Toggle label="SMA 20"    active={settings.indicators.sma20}      onToggle={() => toggleIndicator('sma20')} />
          <Toggle label="SMA 50"    active={settings.indicators.sma50}      onToggle={() => toggleIndicator('sma50')} />
          <Toggle label="SMA 150"   active={settings.indicators.sma150}     onToggle={() => toggleIndicator('sma150')} />
          <Toggle label="SMA 200"   active={settings.indicators.sma200}     onToggle={() => toggleIndicator('sma200')} />
          <Toggle label="RSI"       active={settings.indicators.rsi}        onToggle={() => toggleIndicator('rsi')} />
          <Toggle label="Volume"    active={settings.indicators.volume}     onToggle={() => toggleIndicator('volume')} />
          <Toggle label="Fibonacci" active={settings.indicators.fibonacci}  onToggle={() => toggleIndicator('fibonacci')} />
          <Toggle label="Patterns"  active={settings.indicators.patterns}   onToggle={() => toggleIndicator('patterns')} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#1e2535', marginBottom: 16 }} />

        {/* Thresholds section */}
        <SectionLabel>Thresholds</SectionLabel>
        <Slider
          label="Near Buy Target alert"
          value={settings.thresholds.nearBuyTargetPct}
          min={0.5} max={3.0} step={0.1}
          format={(v) => `${v.toFixed(1)}%`}
          onChange={(v) => setThreshold('nearBuyTargetPct', v)}
        />
        <Slider
          label="Near Stop alert"
          value={settings.thresholds.nearStopPct}
          min={0.5} max={3.0} step={0.1}
          format={(v) => `${v.toFixed(1)}%`}
          onChange={(v) => setThreshold('nearStopPct', v)}
        />
        <Slider
          label="RSI Overbought"
          value={settings.thresholds.rsiOverbought}
          min={60} max={80} step={1}
          format={(v) => `${v.toFixed(0)}`}
          onChange={(v) => setThreshold('rsiOverbought', v)}
        />
        <Slider
          label="Volume confirmation"
          value={settings.thresholds.volumeConfirmation}
          min={1.0} max={2.0} step={0.05}
          format={(v) => `${v.toFixed(2)}x`}
          onChange={(v) => setThreshold('volumeConfirmation', v)}
        />
        <Slider
          label="Min R/R ratio"
          value={settings.thresholds.minRiskReward}
          min={1.0} max={4.0} step={0.1}
          format={(v) => `${v.toFixed(1)}x`}
          onChange={(v) => setThreshold('minRiskReward', v)}
        />

        {/* Divider */}
        <div style={{ height: 1, background: '#1e2535', marginBottom: 16 }} />

        {/* Risk section */}
        <SectionLabel>Risk Management</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#8a93a8', fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: 5 }}>
              Capital
            </div>
            <input
              type="number"
              value={settings.risk.capital}
              onChange={(e) => onUpdate({ risk: { ...settings.risk, capital: Math.max(0, parseInt(e.target.value) || 0) } })}
              style={{
                width: '100%', padding: '7px 10px',
                background: '#0a0c0f', border: '1px solid #252d40', borderRadius: 6,
                color: '#e8eaf0', fontSize: 13, fontFamily: 'IBM Plex Mono, monospace',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <Slider
            label="Risk per trade"
            value={settings.risk.riskPerTrade}
            min={0.5} max={3.0} step={0.1}
            format={(v) => `${v.toFixed(1)}%`}
            onChange={(v) => onUpdate({ risk: { ...settings.risk, riskPerTrade: v } })}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 10px', background: 'rgba(0,212,170,0.06)',
            border: '1px solid rgba(0,212,170,0.15)', borderRadius: 6,
          }}>
            <span style={{ fontSize: 11, color: '#4a5268', fontFamily: 'IBM Plex Sans, sans-serif' }}>
              Max risk per trade
            </span>
            <span style={{ fontSize: 12, color: '#00d4aa', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>
              ${riskAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </motion.div>
    </>
  );
}
