import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { processBatch, setNotify, PORTFOLIO_META } from './services/stock-processor.js';
import type { ProcessedStock } from './types.js';

const app = express();
const server = createServer(app);

// ── Portfolio state ───────────────────────────────────────────────────────────
let portfolio: string[] = Object.keys(PORTFOLIO_META);

// ── CORS ──────────────────────────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL ?? '*';

app.use(cors({
  origin: FRONTEND_URL === '*' ? '*' : [FRONTEND_URL, 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  path: '/stockHub',
  cors: {
    origin: FRONTEND_URL === '*' ? '*' : [FRONTEND_URL, 'http://localhost:5173'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log(`[WS] Connected: ${socket.id}`);

  // Send current snapshot immediately on connect
  processBatch(portfolio).then((stocks) => {
    socket.emit('BatchStockUpdate', stocks);
  });

  socket.on('SubscribeToTicker', (ticker: string) => {
    socket.join(ticker.toUpperCase());
  });

  socket.on('UnsubscribeFromTicker', (ticker: string) => {
    socket.leave(ticker.toUpperCase());
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Disconnected: ${socket.id}`);
  });
});

// ── REST Routes ───────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString(), tickers: portfolio.length });
});

/** Initial snapshot for polling clients */
app.get('/snapshot', async (_req, res) => {
  try {
    const stocks = await processBatch(portfolio);
    res.json(stocks);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/tickers', (_req, res) => res.json(portfolio));

app.post('/tickers', (req, res) => {
  const ticker = (req.body?.ticker ?? '').trim().toUpperCase();
  if (!ticker || ticker.length > 5) { res.status(400).json({ error: 'Invalid ticker' }); return; }
  if (!portfolio.includes(ticker)) portfolio.push(ticker);
  res.json({ ticker });
});

app.delete('/tickers/:ticker', (req, res) => {
  portfolio = portfolio.filter((t) => t !== req.params.ticker.toUpperCase());
  res.sendStatus(204);
});

app.patch('/tickers/:ticker/notify', (req, res) => {
  setNotify(req.params.ticker, req.body?.enabled ?? false);
  res.sendStatus(204);
});

// ── 1-minute broadcast loop ───────────────────────────────────────────────────
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL_MS ?? '60000');

async function broadcastStocks(): Promise<void> {
  try {
    const stocks = await processBatch(portfolio);
    io.emit('BatchStockUpdate', stocks);
    console.log(`[${new Date().toISOString()}] Broadcast ${stocks.length} stocks to ${io.engine.clientsCount} clients`);

    // Fire price alerts
    stocks.forEach((s: ProcessedStock) => {
      if (s.notifyEnabled && s.price <= s.buyTarget) {
        io.to(s.ticker).emit('PriceAlert', s.ticker, s.price, s.buyTarget);
        console.log(`[ALERT] ${s.ticker} @ ${s.price} ≤ ${s.buyTarget}`);
      }
    });
  } catch (e) {
    console.error('[broadcast] Error:', e);
  }
}

setInterval(broadcastStocks, UPDATE_INTERVAL);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '8080');
server.listen(PORT, () => {
  console.log(`🚀 Skeptic's Terminal backend on port ${PORT}`);
  console.log(`   FMP_API_KEY: ${process.env.FMP_API_KEY ? 'YES ✅' : 'NO ❌'}`);
  console.log(`   Update interval: ${UPDATE_INTERVAL}ms`);
});
