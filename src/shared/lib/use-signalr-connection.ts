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

  async function initSocketIO() {
    setLoading(true);

    const apiUrl = import.meta.env.VITE_API_URL;
    console.log('API URL:', apiUrl);

    if (!apiUrl) {
      console.warn('[Socket.io] VITE_API_URL is undefined — fetching snapshot from /api/v1/stocks/snapshot');
      try {
        const res = await fetch('/api/v1/stocks/snapshot');
        const stocks: ProcessedStock[] = await res.json();
        setStocks(stocks);
        setConnected(true);
      } catch (err) {
        console.error('[Snapshot] Failed to fetch snapshot, falling back to demo mode', err);
        initDemoMode();
      } finally {
        setLoading(false);
      }
      return;
    }

    const socket = io(`${apiUrl}/stockHub`, {
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    const fallbackTimer = setTimeout(() => {
      if (!socket.connected) {
        console.warn('[Socket.io] No connection after 5s, falling back to demo mode');
        socket.disconnect();
        socketRef.current = null;
        initDemoMode();
      }
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(fallbackTimer);
      setConnected(true);
      setLoading(false);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('reconnect', () => setConnected(true));
    socket.on('reconnect_attempt', () => setConnected(false));

    socket.on('StockUpdate', (stock: ProcessedStock) => {
      updateStock(stock);
    });

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
