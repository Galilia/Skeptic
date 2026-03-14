import type { OhlcvBar } from '../types';
import { getHistoricalBars } from './yahoo-provider';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  bars:      OhlcvBar[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Returns historical bars for a ticker.
 * On cache miss: fetches from Yahoo Finance and stores result.
 * On cache hit: returns cached bars, updating only the last bar with livePrice if provided.
 */
export async function getCachedBars(
  ticker: string,
  days: number,
  livePrice?: number,
): Promise<OhlcvBar[]> {
  const key = ticker.toUpperCase();
  const entry = cache.get(key);
  const now = Date.now();

  let bars: OhlcvBar[];

  if (entry && now - entry.fetchedAt < CACHE_TTL_MS) {
    // Cache hit — clone to avoid mutating the stored entry
    bars = entry.bars.map(b => ({ ...b }));
  } else {
    // Cache miss — fetch from Yahoo and store
    bars = await getHistoricalBars(key, days);
    if (bars.length) {
      cache.set(key, { bars, fetchedAt: now });
    }
  }

  // Patch last bar with live price when available
  if (bars.length && livePrice != null) {
    const last = bars[bars.length - 1];
    last.close = livePrice;
    last.high  = Math.max(last.high, livePrice);
    last.low   = Math.min(last.low,  livePrice);
  }

  return bars;
}

/** Clear the entire cache (called every 24 h to force a fresh Yahoo fetch). */
export function clearHistoryCache(): void {
  cache.clear();
  console.log('[Cache] History cache cleared');
}
