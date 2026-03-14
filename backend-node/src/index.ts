import express from 'express';
import cors from 'cors';
import { router } from './routes/portfolio.js';
import { setLivePrices, METADATA } from './services/stock-processor.js';
import { getLiveQuotes } from './services/yahoo-provider.js';
import { getCachedBars, clearHistoryCache } from './services/history-cache.js';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── REST routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', router);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Helpers ───────────────────────────────────────────────────────────────────
const TICKERS = Object.keys(METADATA);

async function refreshLivePrices(): Promise<void> {
  try {
    const prices = await getLiveQuotes(TICKERS);
    setLivePrices(prices);
    console.log(`[Polygon] Live prices updated for ${Object.keys(prices).length} tickers`);
  } catch (err) {
    console.error('[Polygon] Failed to fetch live prices:', err);
  }
}

// ── Startup: preload history + initial live prices ────────────────────────────
async function startup(): Promise<void> {
  console.log('[Startup] Preloading history cache…');
  await Promise.all(TICKERS.map(t => getCachedBars(t, 220)));
  console.log('[Startup] History preloaded');
  await refreshLivePrices();
}

// ── Scheduled tasks ───────────────────────────────────────────────────────────
const LIVE_INTERVAL_MS = parseInt(process.env.UPDATE_INTERVAL_MS ?? '0') || 5 * 60_000; // 5 minutes
const CACHE_TTL_MS     = 24 * 60 * 60 * 1000; // 24 hours

// Every 5 minutes: refresh live prices so snapshot endpoint returns fresh data
setInterval(refreshLivePrices, LIVE_INTERVAL_MS);

// Every 24 hours: clear history cache to force a fresh Polygon fetch
setInterval(clearHistoryCache, CACHE_TTL_MS);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '5000');
app.listen(PORT, async () => {
  console.log(`🚀 Skeptic's Terminal backend running on port ${PORT}`);
  console.log(`   REST: http://localhost:${PORT}/api/v1`);
  await startup();
});
