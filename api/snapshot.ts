import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processStock } from './lib/services/stock-processor';

const TICKERS = ['ADM', 'NVDA', 'GE', 'GOOGL', 'INTC', 'MSFT', 'JPM', 'XOM', 'TSLA', 'META'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  try {
    const stocks = await Promise.all(TICKERS.map(t => processStock(t)));
    res.json(stocks.filter(Boolean));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
