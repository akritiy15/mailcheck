# MailCheck

An email verification service: paste one address or up to 100, and find out whether it's safe to send to **without sending any mail**. Built as a compact demo of the problem behind email-deliverability products — keeping bounce rates low to protect a sender's domain reputation.

| Layer | Stack |
| --- | --- |
| App + API | **Next.js 14** (App Router + Route Handlers), **TypeScript**, Zod |
| UI | React + **Tailwind CSS** |
| Database | **MySQL** via `mysql2` (optional: verification history) |
| Tests | Vitest (29 tests, no network or DB needed) |
| Docs | OpenAPI 3 spec at `/api/openapi` |
| Ops | Dockerfile + `docker-compose` |

## What it checks

| Check | How |
| --- | --- |
| Syntax | Pragmatic RFC-style validation (length limits, dots, label rules, TLD) |
| MX records | Real DNS lookup (`dns.resolveMx`) with a 4s timeout; handles Null MX (RFC 7505) |
| Disposable domains | Built-in blocklist (Mailinator, YOPmail, …) |
| Role-based inboxes | `info@`, `support@`, `noreply@`, … |
| Free providers | Gmail, Yahoo, Outlook, … (informational) |
| Typos | Edit-distance "did you mean gmail.com?" hint |

Each address gets a **score (0-100)** and a verdict: `deliverable`, `risky` or `undeliverable`. If DNS is temporarily unavailable the result is `risky` (unknown) rather than wrongly `undeliverable`.

## Engineering highlights

- **Dependency injection** – the MX resolver is a parameter, so the verification logic is fully unit-tested with fake DNS.
- **Bulk verification** with bounded concurrency (10 workers), input de-duplication and a **per-domain MX cache**, so 100 `@acme.com` addresses cost one DNS query.
- **Rate limiting** – fixed-window limiter (30 req/min single, 5 req/min bulk per IP) returning `429` + `Retry-After`.
- **Graceful degradation** – history is stored in MySQL only if `DATABASE_URL` is set, and a database outage never fails a verification.
- **Indexed schema** – `created_at` index for recent history and `domain` index for per-domain analytics ([`sql/schema.sql`](sql/schema.sql)). The table is auto-created on first use.
- Input validation on every route, consistent JSON errors, standalone Docker build.

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

Works immediately with no database. To enable history:

```bash
cp .env.example .env.local     # then set DATABASE_URL
```

### With Docker (app + MySQL)

```bash
docker compose up --build      # http://localhost:3000
```

## Tests

```bash
npm test               # syntax, scoring, typo hints, caching, rate limiter
npm run typecheck
```

## API

Spec: `GET /api/openapi`.

### `POST /api/verify`

```bash
curl -X POST localhost:3000/api/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"info@acme.com"}'
```

```json
{
  "email": "info@acme.com",
  "verdict": "risky",
  "score": 75,
  "reason": "Role-based address (shared inbox)",
  "checks": { "syntax": true, "mx": true, "disposable": false, "roleBased": true, "freeProvider": false },
  "mxHosts": ["mx1.acme.com"],
  "suggestion": null
}
```

### `POST /api/verify/bulk`

Body: `{ "emails": ["a@x.com", "b@y.com"] }` (1-100). Returns `{ summary: { total, deliverable, risky, undeliverable }, results: [...] }`.

### `GET /api/history?limit=20`

Returns `{ enabled, items }`. `enabled` is `false` when no database is configured.

## Deploying

- **Vercel / Netlify**: import the repo and deploy. Add `DATABASE_URL` (e.g. PlanetScale, Railway or AWS RDS MySQL) if you want history.
- **Containers** (Render, Fly.io, ECS): use the included `Dockerfile`.
- Note: the rate limiter is in-memory, so it's per instance. For multiple instances or serverless, swap the `Map` in `lib/rateLimit.ts` for Redis (`INCR` + `EXPIRE`).

## Limitations (by design)

This checks what can be verified safely from DNS and heuristics. It does not open SMTP connections to probe mailboxes (which many servers block or treat as abuse), so a `deliverable` verdict means "valid domain that accepts mail", not "this exact mailbox exists".

## What I'd add next

SMTP-level mailbox probing in a queue worker with proper IP reputation handling, catch-all domain detection, a larger maintained disposable-domain list, and API keys with per-key quotas.
