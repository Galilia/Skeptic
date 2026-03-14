import { useEffect, useRef } from 'react';
import type { ProcessedStock } from '@/entities/stock';
import { getMockStocks, getMockStockUpdate } from '@/entities/stock';
import { useTerminalStore } from '@/shared/model/terminal-store';

/**
 * Manages the data connection lifecycle.
 * Tries real API first (HTTP polling every 30s).
 * Falls back to demo mode on error.
 */
export function useSignalRConnection() {
  const { setStocks, updateStock, setConnected, setLoading, addAlert } =
    useTerminalStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initPolling();
    return () => cleanup();
  }, []);

  function initDemoMode() {
    setLoading(true);
    // Simulate initial snapshot load delay
    setTimeout(() => {
      setStocks(getMockStocks());
      setLoading(false);
      setConnected(true);
    }, 800);

    // Simulate updates every 5s for visible activity
    intervalRef.current = setInterval(() => {
      const stocks = getMockStocks();
      stocks.forEach((s) => {
        const updated = getMockStockUpdate(s.ticker);
        if (updated) {
          updateStock(updated);
          if (updated.notifyEnabled && updated.price <= updated.buyTarget) {
            addAlert({
              id: `${updated.ticker}-${Date.now()}`,
              ticker: updated.ticker,
              message: `${updated.ticker} @ $${updated.price.toFixed(2)} — At or below Buy Target $${updated.buyTarget.toFixed(2)}`,
              type: 'price_alert',
              timestamp: new Date().toISOString(),
            });
          }
        }
      });
    }, 5000);
  }

  async function initPolling() {
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? '';
      console.log('API URL:', apiUrl);
      const res = await fetch(`${apiUrl}/api/v1/stocks/snapshot`);
      const stocks: ProcessedStock[] = await res.json();
      setStocks(stocks);
      setConnected(true);
      setLoading(false);
    } catch {
      initDemoMode();
      return;
    }

    // Poll every 30 seconds for fresh prices
    intervalRef.current = setInterval(async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL ?? '';
        const res = await fetch(`${apiUrl}/api/v1/stocks/snapshot`);
        const stocks: ProcessedStock[] = await res.json();
        stocks.forEach(updateStock);
      } catch {
        setConnected(false);
      }
    }, 30000);
  }

  function cleanup() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }
}
