import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { router } from './routes/portfolio.js';
import { processStock, METADATA } from './services/stock-processor.js';

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

// ── Socket.io (replaces SignalR) ──────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  path: '/stockHub',          // same path as SignalR so frontend config unchanged
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

// ── 1-minute broadcast loop ───────────────────────────────────────────────────
const INTERVAL_MS = 60_000; // 1 minute in production
const DEV_INTERVAL = parseInt(process.env.UPDATE_INTERVAL_MS ?? '0') || INTERVAL_MS;

setInterval(() => {
  const tickers = Object.keys(METADATA);
  const stocks  = tickers.map(t => processStock(t)).filter(Boolean);

  // Push batch to all clients
  io.emit('BatchStockUpdate', stocks);

  // Fire price alerts per ticker group
  stocks.forEach(s => {
    if (s && s.notifyEnabled && s.price <= s.buyTarget) {
      io.to(s.ticker).emit('PriceAlert', s.ticker, s.price, s.buyTarget);
      console.log(`[ALERT] ${s.ticker} @ ${s.price} ≤ ${s.buyTarget}`);
    }
  });

  console.log(`[${new Date().toISOString()}] Pushed ${stocks.length} stocks`);
}, DEV_INTERVAL);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '5000');
server.listen(PORT, () => {
  console.log(`🚀 Skeptic's Terminal backend running on port ${PORT}`);
  console.log(`   REST: http://localhost:${PORT}/api/v1`);
  console.log(`   WS:   ws://localhost:${PORT}/stockHub`);
});
