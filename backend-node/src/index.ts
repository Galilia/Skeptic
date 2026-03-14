import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { router } from './routes/portfolio.js';
import { processStock, setLivePrices, METADATA } from './services/stock-processor.js';
import { getLiveQuotes } from './services/yahoo-provider.js';
import { getCachedBars, clearHistoryCache } from './services/history-cache.js';

const app    = express();
const server = createServer(app);

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  process.env.FRONTEND_URL ?? '',
].filter(Boolean);

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

// ── REST routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', router);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  path: '/stockHub',
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.on('SubscribeToTicker', (ticker: string) => {
    socket.join(ticker.toUpperCase());
  });

  socket.on('UnsubscribeFromTicker', (ticker: string) => {
    socket.leave(ticker.toUpperCase());
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const TICKERS = Object.keys(METADATA);

async function broadcastStocks(): Promise<void> {
  const results = await Promise.all(TICKERS.map(t => processStock(t)));
  const stocks  = results.filter(Boolean) as Awaited<ReturnType<typeof processStock>>[];

  io.emit('BatchStockUpdate', stocks);

  stocks.forEach(s => {
    if (s && s.notifyEnabled && s.price <= s.buyTarget) {
      io.to(s.ticker).emit('PriceAlert', s.ticker, s.price, s.buyTarget);
      console.log(`[ALERT] ${s.ticker} @ ${s.price} ≤ ${s.buyTarget}`);
    }
  });

  console.log(`[${new Date().toISOString()}] Pushed ${stocks.length} stocks`);
}

async function refreshLivePrices(): Promise<void> {
  try {
    const prices = await getLiveQuotes(TICKERS);
    setLivePrices(prices);
    console.log(`[Yahoo] Live prices updated for ${Object.keys(prices).length} tickers`);
  } catch (err) {
    console.error('[Yahoo] Failed to fetch live prices:', err);
  }
}

// ── Startup: preload history + initial live prices ────────────────────────────
async function startup(): Promise<void> {
  console.log('[Startup] Preloading history cache…');
  await Promise.all(TICKERS.map(t => getCachedBars(t, 220)));
  console.log('[Startup] History preloaded');

  await refreshLivePrices();
  await broadcastStocks();
}

// ── Scheduled tasks ───────────────────────────────────────────────────────────
const LIVE_INTERVAL_MS = parseInt(process.env.UPDATE_INTERVAL_MS ?? '0') || 5 * 60_000; // 5 minutes
const CACHE_TTL_MS     = 24 * 60 * 60 * 1000; // 24 hours

// Every 5 minutes: refresh live prices and broadcast
setInterval(async () => {
  await refreshLivePrices();
  await broadcastStocks();
}, LIVE_INTERVAL_MS);

// Every 24 hours: clear history cache so fresh OHLCV data is fetched
setInterval(() => {
  clearHistoryCache();
}, CACHE_TTL_MS);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '5000');
server.listen(PORT, async () => {
  console.log(`🚀 Skeptic's Terminal backend running on port ${PORT}`);
  console.log(`   REST: http://localhost:${PORT}/api/v1`);
  console.log(`   WS:   ws://localhost:${PORT}/stockHub`);
  await startup();
});
