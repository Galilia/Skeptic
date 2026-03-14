import { Router } from 'express';
import { processStock, setNotify, METADATA } from '../services/stock-processor.js';

export const router = Router();

// In-memory portfolio
let portfolio: string[] = Object.keys(METADATA);

/** GET /api/v1/portfolio/tickers */
router.get('/portfolio/tickers', (_req, res) => {
  res.json(portfolio);
});

/** POST /api/v1/portfolio/tickers */
router.post('/portfolio/tickers', (req, res) => {
  const ticker = (req.body?.ticker ?? '').trim().toUpperCase();
  if (!ticker || ticker.length > 5) { res.status(400).json({ error: 'Invalid ticker' }); return; }
  if (!portfolio.includes(ticker)) portfolio.push(ticker);
  res.json({ ticker });
});

/** DELETE /api/v1/portfolio/tickers/:ticker */
router.delete('/portfolio/tickers/:ticker', (req, res) => {
  portfolio = portfolio.filter(t => t !== req.params.ticker.toUpperCase());
  res.sendStatus(204);
});

/** PATCH /api/v1/portfolio/tickers/:ticker/notify */
router.patch('/portfolio/tickers/:ticker/notify', (req, res) => {
  setNotify(req.params.ticker, req.body?.enabled ?? false);
  res.sendStatus(204);
});

/** GET /api/v1/stocks/snapshot — initial load */
router.get('/stocks/snapshot', (_req, res) => {
  const stocks = portfolio.map(t => processStock(t)).filter(Boolean);
  res.json(stocks);
});
