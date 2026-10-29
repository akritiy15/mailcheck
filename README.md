# MailCheck: Email Verification Service

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-29%20passing-6E9F18?logo=vitest&logoColor=white)

Check whether an email address is worth sending to **before** you send a campaign. MailCheck validates syntax, looks up mail server (MX) records, and flags disposable domains, role-based inboxes and likely typos, all without sending a single email.

[Live Demo](https://mailcheck-mu.vercel.app/) · [API Specification](https://mailcheck-mu.vercel.app/api/openapi) · [Source Code](https://github.com/akritiy15/mailcheck)

> **Scope note:** MailCheck uses syntax, DNS and heuristic checks. It does not send emails or probe mailboxes over SMTP, so a "deliverable" verdict is a strong indicator, not proof the inbox exists. See [Limitations](#limitations).

## Why I built it

Cold-outreach tools lose sender reputation when campaigns hit invalid or risky addresses. I built MailCheck as a compact, privacy-conscious example of the kind of service that sits in front of an outbound-email platform: a typed API, deterministic and testable verification logic, and a small UI on top.

## What it does

- **Single and bulk verification:** one address at a time, or up to 100 per request
- **Syntax validation:** format, length limits, domain labels and top-level domains
- **MX record lookup:** confirms the domain has mail servers configured via DNS
- **Disposable email detection:** flags known throwaway providers
- **Role-based address detection:** flags shared inboxes like `info@`, `support@` and `noreply@`
- **Free provider detection:** identifies Gmail, Yahoo, Outlook and similar
- **Typo suggestions:** proposes likely domain corrections using edit-distance matching (for example `gmial.com` → `gmail.com`)
- **Scoring:** returns a 0-100 score and a verdict of `deliverable`, `risky` or `undeliverable`, with the reason behind it
- **CSV export:** download bulk results for further analysis
- **Rate limiting:** separate limits for single and bulk endpoints
- **Optional history:** stores verification history in MySQL when configured

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| API | Next.js App Router route handlers |
| Validation | Zod |
| Database (optional) | MySQL with `mysql2` |
| Testing | Vitest |
| API docs | OpenAPI 3.0 |
| Deployment | Vercel; Docker and Docker Compose for local/containerized runs |

## How it works

1. You submit one address or a list.
2. MailCheck validates the syntax and extracts the domain.
3. It queries DNS for MX records.
4. It checks the domain and local part against disposable lists, role-based names, common providers and typo candidates.
5. Each address gets a score, a verdict and an explanation of the checks that produced it.
6. Bulk results can be exported as CSV.

## Engineering highlights

- **Dependency injection for DNS.** The MX resolver can be swapped for a controlled implementation, so tests are deterministic and don't depend on live DNS or a database.
- **Bounded concurrency.** Bulk verification runs with up to 10 workers, which keeps it fast without flooding DNS.
- **Deduplication and caching.** Duplicate inputs are removed, and MX lookups are cached per domain while a batch is processed.
- **Graceful degradation.** The app works with no database. If MySQL is configured and fails, verification still succeeds; only history is skipped.
- **Request validation.** Payloads are validated with Zod before any work happens.
- **Consistent API behavior.** Structured JSON responses with clear validation and rate-limit errors.

## Design decisions and trade-offs

- **No SMTP probing.** Connecting to mail servers to test mailboxes is unreliable (many servers accept everything or block probes) and can hurt IP reputation. Staying at the DNS and heuristic level keeps the service safe and privacy-friendly, at the cost of not confirming individual mailboxes.
- **Optional database.** History is a nice-to-have, so the core service has no required infrastructure. That makes it trivial to run and deploy.
- **In-memory rate limiting.** Simple and fine for a single-instance demo. It isn't shared across instances, which is why Redis-based limiting is on the roadmap.
- **DNS failures return `risky`, not `undeliverable`.** A temporary lookup failure isn't proof an address is bad, so the verdict reflects that uncertainty.

## API

The full OpenAPI spec is at [`/api/openapi`](https://mailcheck-mu.vercel.app/api/openapi).

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/verify` | Verify one email |
| POST | `/api/verify/bulk` | Verify up to 100 emails |
| GET | `/api/history?limit=20` | Recent history (when the database is configured) |

**Verify one email**

```bash
curl -X POST https://mailcheck-mu.vercel.app/api/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"info@acme.com"}'
```

The response includes the address, verdict, score, reason, the result of each check, MX hosts when available, and a typo suggestion if one applies.

**Verify multiple emails**

```bash
curl -X POST https://mailcheck-mu.vercel.app/api/verify/bulk \
  -H 'Content-Type: application/json' \
  -d '{"emails":["alice@gmail.com","support@example.com","not-an-email"]}'
```

The response includes a summary count of deliverable, risky and undeliverable addresses plus the individual results.

## Run locally

Requirements: Node.js 18+ and npm.

```bash
git clone https://github.com/akritiy15/mailcheck.git
cd mailcheck
npm install
npm run dev        # http://localhost:3000
```

The app works without a database.

**Enable verification history (optional)**

```bash
cp .env.example .env.local
# set DATABASE_URL to your MySQL connection string
```

Never commit `.env.local` or database credentials.

**Run with Docker**

```bash
docker compose up --build   # http://localhost:3000
```

## Tests

```bash
npm test             # verification logic and rate limiting
npm run typecheck    # TypeScript type checking
npm run build        # production build
```

Tests use a controlled DNS resolver, so the core logic is verified without network or database access.

## Limitations

- MailCheck evaluates syntax, domain configuration and heuristics. It does not confirm that a specific mailbox exists or that a message will reach it.
- DNS failures may produce a `risky` result rather than a definitive verdict.
- Rate limiting uses in-memory state and is not shared across multiple server instances.

## What I'd add next

- A larger, regularly updated disposable-domain list
- Catch-all domain detection
- Distributed rate limiting with Redis
- Richer verification history and domain analytics
- Queued verification for very large batches

---

Built with Next.js, TypeScript and MySQL.
