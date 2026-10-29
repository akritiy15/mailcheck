import { describe, expect, it, vi } from "vitest";
import { isValidSyntax, levenshtein, MxResolver, suggestDomain, summarize, verifyEmail, verifyMany } from "../lib/verify";

const hasMx: MxResolver = async () => ["mx.example.com"];
const noMx: MxResolver = async () => [];
const dnsDown: MxResolver = async () => {
  throw new Error("SERVFAIL");
};

describe("isValidSyntax", () => {
  it.each(["a@b.co", "first.last+tag@sub.example.com", "o'brien@example.org"])("accepts %s", (e) => {
    expect(isValidSyntax(e)).toBe(true);
  });

  it.each(["", "plain", "a@b", "a@@b.com", "@b.com", "a@.com", "a..b@x.com", ".a@x.com", "a b@x.com", "a@x.c", "a@-x.com"])(
    "rejects %j",
    (e) => {
      expect(isValidSyntax(e)).toBe(false);
    }
  );

  it("rejects over-long addresses", () => {
    expect(isValidSyntax(`${"a".repeat(65)}@example.com`)).toBe(false);
  });
});

describe("verifyEmail", () => {
  it("marks a normal address with MX as deliverable", async () => {
    const r = await verifyEmail("  Jane@Acme.com ", hasMx);
    expect(r).toMatchObject({ email: "jane@acme.com", verdict: "deliverable", score: 100 });
    expect(r.mxHosts).toEqual(["mx.example.com"]);
  });

  it("flags invalid syntax without touching DNS", async () => {
    const resolver = vi.fn(hasMx);
    const r = await verifyEmail("nope", resolver);
    expect(r.verdict).toBe("undeliverable");
    expect(r.checks.syntax).toBe(false);
    expect(resolver).not.toHaveBeenCalled();
  });

  it("marks domains without MX as undeliverable and suggests typo fixes", async () => {
    const r = await verifyEmail("sam@gmial.com", noMx);
    expect(r.verdict).toBe("undeliverable");
    expect(r.checks.mx).toBe(false);
    expect(r.suggestion).toBe("gmail.com");
    expect(r.reason).toContain("sam@gmail.com");
  });

  it("treats disposable domains as undeliverable-leaning risk", async () => {
    const r = await verifyEmail("x@mailinator.com", hasMx);
    expect(r.checks.disposable).toBe(true);
    expect(r.verdict).toBe("risky");
    expect(r.score).toBe(30);
  });

  it("downgrades role-based addresses to risky", async () => {
    const r = await verifyEmail("info@acme.com", hasMx);
    expect(r.checks.roleBased).toBe(true);
    expect(r.verdict).toBe("risky");
    expect(r.score).toBe(75);
  });

  it("reports risky (not undeliverable) when DNS is temporarily down", async () => {
    const r = await verifyEmail("jane@acme.com", dnsDown);
    expect(r.checks.mx).toBeNull();
    expect(r.verdict).toBe("risky");
  });

  it("detects free providers", async () => {
    expect((await verifyEmail("a@gmail.com", hasMx)).checks.freeProvider).toBe(true);
  });
});

describe("helpers", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });

  it("does not suggest anything for popular or unrelated domains", () => {
    expect(suggestDomain("gmail.com")).toBeNull();
    expect(suggestDomain("acme-corp.io")).toBeNull();
    expect(suggestDomain("yaho.com")).toBe("yahoo.com");
  });
});

describe("verifyMany", () => {
  it("dedupes input and caches MX lookups per domain", async () => {
    const resolver = vi.fn(hasMx);
    const results = await verifyMany(["a@acme.com", "A@acme.com", "b@acme.com", "c@other.io"], resolver);
    expect(results).toHaveLength(3);
    expect(resolver).toHaveBeenCalledTimes(2); // acme.com + other.io
  });

  it("preserves input order and summarizes", async () => {
    const results = await verifyMany(["ok@acme.com", "bad", "info@acme.com"], hasMx, 2);
    expect(results.map((r) => r.email)).toEqual(["ok@acme.com", "bad", "info@acme.com"]);
    expect(summarize(results)).toEqual({ total: 3, deliverable: 1, risky: 1, undeliverable: 1 });
  });
});
