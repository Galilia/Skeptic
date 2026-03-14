import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ProcessedStock } from '@/entities/stock';
import { useTerminalStore } from '@/shared/model/terminal-store';

export function useSignalRConnection() {
  const {
    setStocks, updateStock, setConnected,
    setLoading, setConnectionError, addAlert,
  } = useTerminalStore();
  const socketRef = useRef<Socket | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initSocketIO();
    return () => {
      socketRef.current?.disconnect();
      if (fallbackRef.current) clearInterval(fallbackRef.current);
    };
  }, []);

  async function initSocketIO() {
    setLoading(true);
    setConnectionError(null);

    const apiUrl = import.meta.env.VITE_API_URL ?? '';
    console.log('API URL:', apiUrl);

    if (!apiUrl) {
      setStocks([]);
      setConnected(false);
      setLoading(false);
      setConnectionError('VITE_API_URL is not set');
      return;
    }

    const socket = io(apiUrl, {
      path: '/stockHub',
      transports: ['websocket', 'polling'],
      timeout: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.io] Connected');
      setConnected(true);
      setLoading(false);
      setConnectionError(null);
    });

    socket.on('BatchStockUpdate', (stocks: ProcessedStock[]) => {
      const valid = stocks.filter((s) => s && s.ticker && s.indicators);
      setStocks(valid);
    });

    socket.on('StockUpdate', (stock: ProcessedStock) => {
      if (stock?.ticker && stock?.indicators) updateStock(stock);
    });

    socket.on('PriceAlert', (ticker: string, price: number, target: number) => {
      addAlert({
        id: `${ticker}-${Date.now()}`,
        ticker,
        message: `${ticker} @ ${price.toFixed(2)} — hit Buy Target ${target.toFixed(2)}`,
        type: 'price_alert',
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket.io] Error:', err.message);
      setConnected(false);
      setLoading(false);
      setConnectionError('No connection to server');
    });
  }
}
