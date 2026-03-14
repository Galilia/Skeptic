import { Router } from 'express';
import { processStock, setNotify, METADATA } from '../services/stock-processor.js';

export const router = Router();

// In-memory portfolio
let portfolio: string[] = Object.keys(METADATA);

/** GET /tickers */
router.get('/tickers', (_req, res) => {
  res.json(portfolio);
});

/** POST /tickers */
router.post('/tickers', (req, res) => {
  const ticker = (req.body?.ticker ?? '').trim().toUpperCase();
  if (!ticker || ticker.length > 5) { res.status(400).json({ error: 'Invalid ticker' }); return; }
  if (!portfolio.includes(ticker)) portfolio.push(ticker);
  res.json({ ticker });
});

/** DELETE /tickers/:ticker */
router.delete('/tickers/:ticker', (req, res) => {
  portfolio = portfolio.filter(t => t !== req.params.ticker.toUpperCase());
  res.sendStatus(204);
});

/** PATCH /tickers/:ticker/notify */
router.patch('/tickers/:ticker/notify', (req, res) => {
  setNotify(req.params.ticker, req.body?.enabled ?? false);
  res.sendStatus(204);
});

/** GET /snapshot — initial load */
router.get('/snapshot', async (_req, res) => {
  try {
    console.log('[snapshot] portfolio:', portfolio);
    const results = [];
    for (const ticker of portfolio) {
      try {
        const stock = await processStock(ticker);
        console.log('[snapshot]', ticker, ':', stock ? 'OK' : 'NULL',
          stock ? 'price=' + stock.price : '');
        if (stock && stock.ticker) results.push(stock);
      } catch (e) {
        console.error('[snapshot] error for', ticker, e);
      }
    }
    console.log('[snapshot] returning', results.length, 'stocks');
    res.json(results);
  } catch (e) {
    console.error('[snapshot] fatal error:', e);
    res.status(500).json({ error: String(e) });
  }
});
