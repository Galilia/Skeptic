import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_TICKERS = ['ADM', 'NVDA', 'GE', 'GOOGL', 'INTC', 'MSFT', 'JPM', 'XOM', 'TSLA', 'META'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.json(DEFAULT_TICKERS);
  }
  if (req.method === 'POST') {
    const ticker = (req.body?.ticker ?? '').trim().toUpperCase();
    if (!ticker || ticker.length > 5) return res.status(400).json({ error: 'Invalid ticker' });
    return res.json({ ticker });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
