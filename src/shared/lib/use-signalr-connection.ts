import { useEffect, useRef } from 'react';
import type { ProcessedStock } from '@/entities/stock';
import { useTerminalStore } from '@/shared/model/terminal-store';

/**
 * Fetches /snapshot on mount, then polls every 30 seconds.
 * On failure: sets connectionError and shows an empty grid — no mock fallback.
 */
export function useSignalRConnection() {
  const { setStocks, updateStock, setConnected, setLoading, setConnectionError } =
    useTerminalStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initPolling();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function initPolling() {
    setLoading(true);
    setConnectionError(null);

    try {
      const res = await fetch('/api/snapshot');
      const data = await res.json();
      const stocks: ProcessedStock[] = data.filter((s: any) => s && s.ticker && s.indicators);
      setStocks(stocks);
      setConnected(true);
      setLoading(false);
    } catch {
      setStocks([]);
      setConnected(false);
      setLoading(false);
      setConnectionError('No connection to server');
      return;
    }

    // Poll every 30 seconds for fresh prices
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/snapshot');
        const data = await res.json();
      const stocks: ProcessedStock[] = data.filter((s: any) => s && s.ticker && s.indicators);
        stocks.forEach(updateStock);
        setConnected(true);
        setConnectionError(null);
      } catch {
        setConnected(false);
        setConnectionError('No connection to server');
      }
    }, 30000);
  }
}
