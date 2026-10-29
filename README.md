MailCheck — Email Verification Service

Verify email addresses before sending campaigns. MailCheck checks email syntax, mail server (MX) records, disposable domains, role-based inboxes, and common domain typos—without sending any emails.

🔗 Links

* 🚀 Live Demo: https://mailcheck-mu.vercel.app/
* 📖 API Specification: https://mailcheck-mu.vercel.app/api/openapi
* 💻 Source Code: https://github.com/akritiy15/mailcheck

⸻

✨ Features

* Single Email Verification: Analyze an individual email address.
* Bulk Verification: Process up to 100 email addresses in one request.
* Syntax Validation: Check email formatting, length limits, domain labels, and top-level domains.
* MX Record Lookup: Check whether a domain has mail servers configured using DNS lookups.
* Disposable Email Detection: Identify addresses from known disposable email providers.
* Role-Based Address Detection: Flag shared inboxes such as info@, support@, and noreply@.
* Free Email Provider Detection: Identify common providers such as Gmail, Yahoo, and Outlook.
* Typo Suggestions: Suggest likely domain corrections using edit-distance matching.
* Verification Scoring: Return a score from 0–100 with a verdict of deliverable, risky, or undeliverable.
* CSV Export: Download bulk verification results for further analysis.
* Rate Limiting: Limit requests to help prevent API abuse.
* Optional Verification History: Store verification history in MySQL when configured.

🛠️ Tech Stack

Layer	Technologies
Frontend	Next.js 14, React, TypeScript
Styling	Tailwind CSS
API	Next.js App Router and Route Handlers
Validation	Zod
Database	MySQL with mysql2
Testing	Vitest
API Documentation	OpenAPI 3.0
Deployment	Vercel
Containerization	Docker, Docker Compose

⚙️ How It Works

1. Enter one email address or provide a list of addresses.
2. MailCheck validates syntax and examines the email domain.
3. DNS MX records are queried to check mail-server configuration.
4. The service checks for disposable domains, role-based inboxes, common providers, and possible typos.
5. Each address receives a score, a verdict, and an explanation of the checks performed.
6. Bulk results can be exported as a CSV file.

Privacy-conscious by design: MailCheck does not send emails or attempt SMTP mailbox probing. A deliverable verdict is an indicator based on syntax and domain-level checks, not proof that a particular mailbox exists.

🧪 Testing

The project includes 29 automated tests covering verification logic and rate limiting.

Run the test suite:

npm test

Run TypeScript type checking:

npm run typecheck

Create a production build:

npm run build

Tests use controlled DNS behavior where appropriate, so the core verification logic can be tested without depending on live DNS or a database.

🚀 Run Locally

Prerequisites

* Node.js 18 or later
* npm

Installation

Clone the repository:

git clone https://github.com/akritiy15/mailcheck.git
cd mailcheck

Install dependencies:

npm install

Start the development server:

npm run dev

Open:

http://localhost:3000

The application works without a database. MySQL is optional and is used for verification history.

Configure MySQL (Optional)

Copy the example environment file:

cp .env.example .env.local

Configure DATABASE_URL in .env.local with your MySQL connection string if you want to enable verification history.

Do not commit .env.local or database credentials to GitHub.

Run with Docker

If Docker is installed and running:

docker compose up --build

Then open:

http://localhost:3000

📡 API Reference

The OpenAPI specification is available at:

https://mailcheck-mu.vercel.app/api/openapi

Verify One Email

POST /api/verify

Example request:

{
  "email": "info@acme.com"
}

The response includes the email address, verdict, score, reason, individual check results, MX hosts when available, and any domain typo suggestion.

Verify Multiple Emails

POST /api/verify/bulk

Example request:

{
  "emails": [
    "alice@gmail.com",
    "support@example.com",
    "not-an-email"
  ]
}

The response includes a summary of deliverable, risky, and undeliverable addresses, along with the individual results.

The bulk endpoint accepts up to 100 email addresses per request.

Retrieve Verification History

GET /api/history?limit=20

Returns recent verification history when database storage is configured. Otherwise, the response indicates that history is disabled.

🏗️ Engineering Highlights

* Dependency injection: The MX resolver can be replaced with a controlled implementation for deterministic tests.
* Bounded concurrency: Bulk verification uses up to 10 workers.
* Deduplication and caching: Duplicate inputs are removed, and MX lookups are cached per domain during processing.
* Rate limiting: Separate limits apply to single and bulk verification requests.
* Graceful degradation: Database failures do not prevent email verification, and history remains optional.
* Input validation: Request payloads are validated before processing.
* Consistent API responses: Endpoints return structured JSON responses and appropriate validation and rate-limit errors.

⚠️ Limitations

MailCheck evaluates email syntax, domain configuration, and heuristics. It does not send emails or establish SMTP connections to verify individual mailboxes.

A deliverable result does not guarantee that the specific inbox exists or that a message will reach it. DNS failures may also produce a risky result rather than a definitive verdict.

The rate limiter uses in-memory state, which is suitable for a compact demonstration but is not shared across multiple server instances.

🔮 Future Improvements

* Expand and maintain the disposable-domain list.
* Add catch-all domain detection.
* Introduce distributed rate limiting with Redis.
* Add richer verification history and domain analytics.
* Explore queued verification workflows for larger batches.

⸻

Built with Next.js, TypeScript, and MySQL.