import { create } from 'zustand';
import type { ProcessedStock, StockFilter, VerdictType } from '@/entities/stock';
import { DEFAULT_FILTER } from '@/entities/stock';

interface TerminalState {
  /** Full list of processed stocks from SignalR stream */
  stocks: ProcessedStock[];
  /** Active filter criteria */
  filter: StockFilter;
  /** Selected ticker for the side-panel audit view */
  selectedTicker: string | null;
  /** Whether SignalR is currently connected */
  isConnected: boolean;
  /** Loading state for initial snapshot fetch */
  isLoading: boolean;
  /** Last SignalR alert messages */
  alerts: AlertMessage[];

  // Actions
  setStocks: (stocks: ProcessedStock[]) => void;
  updateStock: (stock: ProcessedStock) => void;
  setFilter: (filter: Partial<StockFilter>) => void;
  resetFilter: () => void;
  toggleSector: (sector: string) => void;
  toggleStrategy: (strategy: string) => void;
  toggleVerdict: (verdict: VerdictType) => void;
  setSelectedTicker: (ticker: string | null) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  toggleNotify: (ticker: string) => void;
  addAlert: (alert: AlertMessage) => void;
  dismissAlert: (id: string) => void;
  addTicker: (ticker: string) => void;
  removeTicker: (ticker: string) => void;
}

export interface AlertMessage {
  id: string;
  ticker: string;
  message: string;
  type: 'price_alert' | 'signal' | 'info';
  timestamp: string;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  stocks: [],
  filter: DEFAULT_FILTER,
  selectedTicker: null,
  isConnected: false,
  isLoading: true,
  alerts: [],

  setStocks: (stocks) => set({ stocks }),

  updateStock: (updated) =>
    set((state) => ({
      stocks: state.stocks.map((s) =>
        s.ticker === updated.ticker ? updated : s
      ),
    })),

  setFilter: (partial) =>
    set((state) => ({ filter: { ...state.filter, ...partial } })),

  resetFilter: () => set({ filter: DEFAULT_FILTER }),

  toggleSector: (sector) =>
    set((state) => ({
      filter: {
        ...state.filter,
        sectors: state.filter.sectors.includes(sector)
          ? state.filter.sectors.filter((s) => s !== sector)
          : [...state.filter.sectors, sector],
      },
    })),

  toggleStrategy: (strategy) =>
    set((state) => ({
      filter: {
        ...state.filter,
        strategies: state.filter.strategies.includes(strategy)
          ? state.filter.strategies.filter((s) => s !== strategy)
          : [...state.filter.strategies, strategy],
      },
    })),

  toggleVerdict: (verdict) =>
    set((state) => ({
      filter: {
        ...state.filter,
        verdicts: state.filter.verdicts.includes(verdict)
          ? state.filter.verdicts.filter((v) => v !== verdict)
          : [...state.filter.verdicts, verdict],
      },
    })),

  setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),

  setConnected: (connected) => set({ isConnected: connected }),

  setLoading: (loading) => set({ isLoading: loading }),

  toggleNotify: (ticker) =>
    set((state) => ({
      stocks: state.stocks.map((s) =>
        s.ticker === ticker ? { ...s, notifyEnabled: !s.notifyEnabled } : s
      ),
    })),

  addAlert: (alert) =>
    set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 20) })),

  dismissAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),

  addTicker: (ticker) =>
    set((state) => {
      if (state.stocks.some((s) => s.ticker === ticker)) return state;
      return state; // Actual addition comes via SignalR after server confirms
    }),

  removeTicker: (ticker) =>
    set((state) => ({ stocks: state.stocks.filter((s) => s.ticker !== ticker) })),
}));
