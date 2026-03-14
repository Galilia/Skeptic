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

    const apiUrl = import.meta.env.VITE_API_URL ?? '';
    console.log('API URL:', apiUrl);

    try {
      const res = await fetch(`${apiUrl}/snapshot`);
      const stocks: ProcessedStock[] = await res.json();
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
        const apiUrl = import.meta.env.VITE_API_URL ?? '';
        const res = await fetch(`${apiUrl}/snapshot`);
        const stocks: ProcessedStock[] = await res.json();
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
