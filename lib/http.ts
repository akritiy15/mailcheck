import { NextResponse } from "next/server";
import { createRateLimiter, RateLimitResult } from "./rateLimit";

// Survive hot reloads in dev so counters aren't reset on every edit.
const g = globalThis as unknown as {
  __singleLimiter?: ReturnType<typeof createRateLimiter>;
  __bulkLimiter?: ReturnType<typeof createRateLimiter>;
};

export const singleLimiter = (g.__singleLimiter ??= createRateLimiter({ limit: 30, windowMs: 60_000 }));
export const bulkLimiter = (g.__bulkLimiter ??= createRateLimiter({ limit: 5, windowMs: 60_000 }));

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export function tooManyRequests(rl: RateLimitResult) {
  const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Rate limit exceeded", retryAfterSeconds: retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}
