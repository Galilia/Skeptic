import type { ProcessedStock } from '../model/types/stock';

const BASE_URL = '';
const TIMEOUT_MS = 600_000;

async function fetchWithTimeout<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  } finally {
    clearTimeout(id);
  }
}

/** Retrieve the current portfolio tickers stored on the server */
export const getPortfolioTickersApi = async (): Promise<string[]> =>
  fetchWithTimeout<string[]>('/portfolio/tickers');

/** Add a ticker to the monitored portfolio */
export const addTickerApi = async (ticker: string): Promise<void> =>
  fetchWithTimeout<void>('/portfolio/tickers', {
    method: 'POST',
    body: JSON.stringify({ ticker }),
  });

/** Remove a ticker from the monitored portfolio */
export const removeTickerApi = async (ticker: string): Promise<void> =>
  fetchWithTimeout<void>(`/portfolio/tickers/${ticker}`, { method: 'DELETE' });

/** Toggle the price-alert notification for a ticker */
export const toggleNotifyApi = async (ticker: string, enabled: boolean): Promise<void> =>
  fetchWithTimeout<void>(`/portfolio/tickers/${ticker}/notify`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });

/** Get the latest snapshot for all monitored stocks (initial load before SignalR) */
export const getStockSnapshotApi = async (): Promise<ProcessedStock[]> =>
  fetchWithTimeout<ProcessedStock[]>('/snapshot');
