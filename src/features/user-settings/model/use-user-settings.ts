import { useState, useCallback } from 'react';

export interface UserSettings {
  indicators: {
    sma20: boolean;
    sma50: boolean;
    sma150: boolean;
    sma200: boolean;
    rsi: boolean;
    volume: boolean;
    fibonacci: boolean;
    patterns: boolean;
  };
  thresholds: {
    /** % distance from buyTarget to flag as nearBuyTarget */
    nearBuyTargetPct: number;
    /** % distance from stop to flag as nearStop */
    nearStopPct: number;
    rsiOverbought: number;
    /** Volume must be this multiple of average to confirm */
    volumeConfirmation: number;
    minRiskReward: number;
  };
  risk: {
    capital: number;
    riskPerTrade: number;
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  indicators: {
    sma20: true,
    sma50: true,
    sma150: true,
    sma200: true,
    rsi: true,
    volume: true,
    fibonacci: true,
    patterns: true,
  },
  thresholds: {
    nearBuyTargetPct: 1.5,
    nearStopPct: 1.5,
    rsiOverbought: 70,
    volumeConfirmation: 1.3,
    minRiskReward: 2.0,
  },
  risk: {
    capital: 10000,
    riskPerTrade: 1.0,
  },
};

const STORAGE_KEY = 'skeptic-settings';

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    // Deep-merge so new keys get defaults even if stored settings are older
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      indicators: { ...DEFAULT_SETTINGS.indicators, ...parsed.indicators },
      thresholds: { ...DEFAULT_SETTINGS.thresholds, ...parsed.thresholds },
      risk: { ...DEFAULT_SETTINGS.risk, ...parsed.risk },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  const update = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next: UserSettings = {
        indicators: { ...prev.indicators, ...patch.indicators },
        thresholds: { ...prev.thresholds, ...patch.thresholds },
        risk:       { ...prev.risk,       ...patch.risk },
      };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { settings, update };
}
