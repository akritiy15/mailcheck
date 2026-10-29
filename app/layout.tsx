import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MailCheck",
  description: "Verify email addresses before you send",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <span className="text-lg font-semibold text-emerald-600">MailCheck</span>
            <a href="/api/openapi" target="_blank" className="text-sm text-slate-500 hover:text-slate-800">
              OpenAPI spec ↗
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
