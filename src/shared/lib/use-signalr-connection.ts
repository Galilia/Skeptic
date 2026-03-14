import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ProcessedStock } from '@/entities/stock';
import { getMockStocks, getMockStockUpdate } from '@/entities/stock';
import { useTerminalStore } from '@/shared/model/terminal-store';

const DEMO_MODE = false; // Set false when real backend is available

/**
 * Manages the Socket.io connection lifecycle.
 * In demo mode, simulates a real-time stream using setInterval.
 * In production mode, connects to /stockHub and subscribes to events.
 */
export function useSignalRConnection() {
  const { setStocks, updateStock, setConnected, setLoading, addAlert } =
    useTerminalStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (DEMO_MODE) {
      initDemoMode();
    } else {
      initSocketIO();
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
    intervalRef.current = setInterval(() => {
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

  function initSocketIO() {
    try {
      const socket = io(`${import.meta.env.VITE_API_URL}/stockHub`, {
        transports: ['websocket'],
        reconnection: true,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        setLoading(false);
      });

      socket.on('disconnect', () => setConnected(false));

      socket.on('reconnect', () => setConnected(true));
      socket.on('reconnect_attempt', () => setConnected(false));

      socket.on('BatchStockUpdate', (stocks: ProcessedStock[]) => {
        stocks.forEach(updateStock);
      });

      socket.on('PriceAlert', (ticker: string, price: number, target: number) => {
        addAlert({
          id: `${ticker}-${Date.now()}`,
          ticker,
          message: `${ticker} @ $${price.toFixed(2)} — Hit Buy Target $${target.toFixed(2)}`,
          type: 'price_alert',
          timestamp: new Date().toISOString(),
        });
      });

      setLoading(true);
    } catch (err) {
      console.error('[Socket.io] Connection failed, falling back to demo mode', err);
      initDemoMode();
    }
  }

  function cleanup() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }
}
