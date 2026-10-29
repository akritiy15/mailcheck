export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** epoch ms when the current window resets */
  resetAt: number;
}

/**
 * Fixed-window, in-memory rate limiter.
 * Fine for a single instance; for multiple instances swap the Map for Redis (INCR + EXPIRE).
 */
export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }) {
  const { limit, windowMs } = opts;
  const now = opts.now ?? Date.now;
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string): RateLimitResult {
    const t = now();

    // opportunistic cleanup so the map can't grow forever
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    return {
      allowed: entry.count <= limit,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
    };
  };
}
