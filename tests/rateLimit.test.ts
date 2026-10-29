import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../lib/rateLimit";

describe("createRateLimiter", () => {
  it("allows up to the limit, then blocks", () => {
    let t = 0;
    const check = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect(check("ip").allowed).toBe(true);
    expect(check("ip").allowed).toBe(true);
    const blocked = check("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks keys independently", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    expect(check("a").allowed).toBe(true);
    expect(check("b").allowed).toBe(true);
    expect(check("a").allowed).toBe(false);
  });

  it("resets after the window passes", () => {
    let t = 0;
    const check = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    check("ip");
    expect(check("ip").allowed).toBe(false);
    t = 1001;
    expect(check("ip").allowed).toBe(true);
  });
});
