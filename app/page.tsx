"use client";

import { FormEvent, useEffect, useState } from "react";
import type { VerifyResult } from "@/lib/verify";

type Summary = { total: number; deliverable: number; risky: number; undeliverable: number };
type HistoryItem = { id: number; email: string; verdict: string; score: number; createdAt: string };

const verdictStyle: Record<string, string> = {
  deliverable: "bg-green-100 text-green-700",
  risky: "bg-amber-100 text-amber-700",
  undeliverable: "bg-red-100 text-red-700",
};

function Badge({ verdict }: { verdict: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${verdictStyle[verdict]}`}>{verdict}</span>;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.retryAfterSeconds ? `Rate limit hit — retry in ${data.retryAfterSeconds}s` : data.error ?? "Request failed");
  return data as T;
}

function toCsv(results: VerifyResult[]) {
  const rows = results.map((r) => [r.email, r.verdict, r.score, `"${r.reason.replace(/"/g, '""')}"`].join(","));
  return ["email,verdict,score,reason", ...rows].join("\n");
}

export default function Home() {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [email, setEmail] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [results, setResults] = useState<VerifyResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = () =>
    fetch("/api/history?limit=10")
      .then((r) => r.json())
      .then((d) => setHistory(d.enabled ? d.items : null))
      .catch(() => setHistory(null));

  useEffect(() => {
    loadHistory();
  }, []);

  async function run(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "single") {
        const r = await post<VerifyResult>("/api/verify", { email });
        setResults([r]);
        setSummary(null);
      } else {
        const emails = bulkText.split(/[\s,;]+/).filter(Boolean);
        const r = await post<{ summary: Summary; results: VerifyResult[] }>("/api/verify/bulk", { emails });
        setResults(r.results);
        setSummary(r.summary);
      }
      loadHistory();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([toCsv(results)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mailcheck-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Verify emails before you send</h1>
        <p className="text-slate-500">Checks syntax, MX records, disposable domains and role-based inboxes — no email is ever sent.</p>
      </div>

      <div className="inline-flex rounded-lg border bg-white p-1 text-sm">
        {(["single", "bulk"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-4 py-1.5 ${mode === m ? "bg-emerald-600 text-white" : "text-slate-600"}`}
          >
            {m === "single" ? "Single" : "Bulk (up to 100)"}
          </button>
        ))}
      </div>

      <form onSubmit={run} className="rounded-lg border bg-white p-4">
        {mode === "single" ? (
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            className="w-full rounded border px-3 py-2"
          />
        ) : (
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            placeholder="Paste emails separated by new lines, commas or spaces"
            className="w-full rounded border px-3 py-2 font-mono text-sm"
          />
        )}
        <button
          disabled={loading || !(mode === "single" ? email.trim() : bulkText.trim())}
          className="mt-3 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify"}
        </button>
        {error && <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </form>

      {summary && (
        <div className="grid grid-cols-4 gap-3 text-center">
          {(["total", "deliverable", "risky", "undeliverable"] as const).map((k) => (
            <div key={k} className="rounded-lg border bg-white p-3">
              <p className="text-xs uppercase text-slate-500">{k}</p>
              <p className="text-2xl font-semibold">{summary[k]}</p>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <section className="overflow-hidden rounded-lg border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Results</h2>
            {results.length > 1 && (
              <button onClick={download} className="text-sm text-emerald-700 hover:underline">
                Download CSV
              </button>
            )}
          </div>
          <ul className="divide-y">
            {results.map((r) => (
              <li key={r.email} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{r.email}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">{r.score}/100</span>
                    <Badge verdict={r.verdict} />
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{r.reason}</p>
                {r.suggestion && (
                  <p className="mt-1 text-sm text-amber-700">Did you mean the domain {r.suggestion}?</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {history && history.length > 0 && (
        <section className="rounded-lg border bg-white">
          <h2 className="border-b px-4 py-3 font-semibold">Recent verifications</h2>
          <ul className="divide-y text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between px-4 py-2">
                <span>{h.email}</span>
                <Badge verdict={h.verdict} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
