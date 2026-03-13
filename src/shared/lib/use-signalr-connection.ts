import { useEffect, useRef } from 'react';
import type { ProcessedStock } from '@/entities/stock';
import { getMockStocks, getMockStockUpdate } from '@/entities/stock';
import { useTerminalStore } from '@/shared/model/terminal-store';

const DEMO_MODE = true; // Set false when real .NET backend is available

/**
 * Manages the SignalR connection lifecycle.
 * In demo mode, simulates a real-time stream using setInterval.
 * In production mode, connects to /stockHub and subscribes to "StockUpdate" events.
 */
export function useSignalRConnection() {
  const { setStocks, updateStock, setConnected, setLoading, addAlert } =
    useTerminalStore();
  const connectionRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (DEMO_MODE) {
      initDemoMode();
    } else {
      initSignalR();
    }
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

    // Simulate 1-minute interval updates (using 5s in demo for visible activity)
    connectionRef.current = setInterval(() => {
      const stocks = getMockStocks();
      stocks.forEach((s) => {
        const updated = getMockStockUpdate(s.ticker);
        if (updated) {
          updateStock(updated);
          // Simulate price-alert trigger
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

  async function initSignalR() {
    try {
      // Dynamic import avoids bundling SignalR when in demo mode
      const { HubConnectionBuilder, LogLevel } = await import('@microsoft/signalr');
      const connection = new HubConnectionBuilder()
        .withUrl('/stockHub')
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      connection.on('StockUpdate', (stock: ProcessedStock) => {
        updateStock(stock);
      });

      connection.on('BatchStockUpdate', (stocks: ProcessedStock[]) => {
        stocks.forEach(updateStock);
      });

      connection.on('PriceAlert', (ticker: string, price: number, target: number) => {
        addAlert({
          id: `${ticker}-${Date.now()}`,
          ticker,
          message: `${ticker} @ $${price.toFixed(2)} — Hit Buy Target $${target.toFixed(2)}`,
          type: 'price_alert',
          timestamp: new Date().toISOString(),
        });
      });

      connection.onreconnecting(() => setConnected(false));
      connection.onreconnected(() => setConnected(true));
      connection.onclose(() => setConnected(false));

      setLoading(true);
      await connection.start();
      setConnected(true);
      setLoading(false);
    } catch (err) {
      console.error('[SignalR] Connection failed, falling back to demo mode', err);
      initDemoMode();
    }
  }

  function cleanup() {
    if (connectionRef.current) {
      clearInterval(connectionRef.current);
    }
  }
}
