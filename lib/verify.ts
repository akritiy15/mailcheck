import { promises as dns } from "node:dns";

export type Verdict = "deliverable" | "risky" | "undeliverable";

export interface VerifyResult {
  email: string;
  verdict: Verdict;
  /** 0-100, higher is safer to send to */
  score: number;
  reason: string;
  checks: {
    syntax: boolean;
    /** null = DNS lookup failed temporarily, so we can't tell */
    mx: boolean | null;
    disposable: boolean;
    roleBased: boolean;
    freeProvider: boolean;
  };
  mxHosts: string[];
  /** "Did you mean ...?" hint for common domain typos */
  suggestion: string | null;
}

/** Returns MX hosts (best priority first). Return [] when the domain has none; throw on temporary DNS errors. */
export type MxResolver = (domain: string) => Promise<string[]>;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
]);

const ROLE_LOCAL_PARTS = new Set([
  "admin",
  "info",
  "support",
  "sales",
  "contact",
  "hello",
  "help",
  "office",
  "team",
  "billing",
  "postmaster",
  "abuse",
  "webmaster",
  "noreply",
  "no-reply",
  "donotreply",
]);

const FREE_PROVIDERS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

const POPULAR_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "protonmail.com"];

const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

export function suggestDomain(domain: string): string | null {
  if (POPULAR_DOMAINS.includes(domain)) return null;
  let best: { d: string; dist: number } | null = null;
  for (const d of POPULAR_DOMAINS) {
    const dist = levenshtein(domain, d);
    if (dist <= 2 && (!best || dist < best.dist)) best = { d, dist };
  }
  return best?.d ?? null;
}

export function isValidSyntax(email: string): boolean {
  if (email.length > 254) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || !LOCAL_PART.test(local)) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (!labels.every((l) => DOMAIN_LABEL.test(l))) return false;
  return /^[a-z]{2,}$/.test(labels[labels.length - 1]);
}

/** Default resolver backed by Node's DNS, with a timeout. */
export const dnsMxResolver: MxResolver = async (domain) => {
  const lookup = dns.resolveMx(domain).then((records) =>
    records
      .filter((r) => r.exchange && r.exchange !== ".") // "." is a Null MX (RFC 7505): domain accepts no mail
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange)
  );
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DNS timeout")), 4000));
  try {
    return await Promise.race([lookup, timeout]);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") return []; // definitive: no such domain / no MX
    throw err; // temporary failure (timeout, SERVFAIL...) → caller treats as unknown
  }
};

export async function verifyEmail(raw: string, resolveMx: MxResolver = dnsMxResolver): Promise<VerifyResult> {
  const email = raw.trim().toLowerCase();
  const base: VerifyResult = {
    email,
    verdict: "undeliverable",
    score: 0,
    reason: "",
    checks: { syntax: false, mx: null, disposable: false, roleBased: false, freeProvider: false },
    mxHosts: [],
    suggestion: null,
  };

  if (!isValidSyntax(email)) {
    return { ...base, reason: "Invalid email syntax" };
  }

  const [local, domain] = email.split("@");
  const checks = {
    syntax: true,
    mx: null as boolean | null,
    disposable: DISPOSABLE_DOMAINS.has(domain),
    roleBased: ROLE_LOCAL_PARTS.has(local),
    freeProvider: FREE_PROVIDERS.has(domain),
  };
  const suggestion = suggestDomain(domain);

  let mxHosts: string[] = [];
  try {
    mxHosts = await resolveMx(domain);
    checks.mx = mxHosts.length > 0;
  } catch {
    checks.mx = null;
  }

  if (checks.mx === false) {
    const hint = suggestion ? ` Did you mean ${local}@${suggestion}?` : "";
    return { ...base, checks, suggestion, reason: `Domain has no mail server (MX).${hint}` };
  }

  let score = 100;
  const notes: string[] = [];
  if (checks.mx === null) {
    score -= 50;
    notes.push("couldn't confirm the domain's mail server (DNS lookup failed)");
  }
  if (checks.disposable) {
    score -= 70;
    notes.push("disposable email provider");
  }
  if (checks.roleBased) {
    score -= 25;
    notes.push("role-based address (shared inbox)");
  }

  score = Math.max(0, score);
  const verdict: Verdict = score >= 80 ? "deliverable" : score >= 30 ? "risky" : "undeliverable";
  const reason = notes.length ? notes[0][0].toUpperCase() + notes.join("; ").slice(1) : "Valid syntax and mail server found";

  return { email, verdict, score, reason, checks, mxHosts, suggestion };
}

/** Verifies many addresses with bounded concurrency; MX lookups are cached per domain within the call. */
export async function verifyMany(
  emails: string[],
  resolveMx: MxResolver = dnsMxResolver,
  concurrency = 10
): Promise<VerifyResult[]> {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const cache = new Map<string, Promise<string[]>>();
  const cachedResolver: MxResolver = (domain) => {
    if (!cache.has(domain)) cache.set(domain, resolveMx(domain));
    return cache.get(domain)!;
  };

  const results: VerifyResult[] = new Array(unique.length);
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const i = next++;
      results[i] = await verifyEmail(unique[i], cachedResolver);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return results;
}

export function summarize(results: VerifyResult[]) {
  const summary = { total: results.length, deliverable: 0, risky: 0, undeliverable: 0 };
  for (const r of results) summary[r.verdict]++;
  return summary;
}
