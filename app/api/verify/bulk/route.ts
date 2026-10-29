import { NextResponse } from "next/server";
import { z } from "zod";
import { saveResults } from "@/lib/db";
import { badRequest, bulkLimiter, clientIp, tooManyRequests } from "@/lib/http";
import { summarize, verifyMany } from "@/lib/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  emails: z.array(z.string().trim().min(1).max(320)).min(1).max(100),
});

export async function POST(req: Request) {
  const rl = bulkLimiter(clientIp(req));
  if (!rl.allowed) return tooManyRequests(rl);

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest("Body must be { emails: string[] } with 1-100 items", body.error.issues);

  const results = await verifyMany(body.data.emails);
  await saveResults(results);
  return NextResponse.json({ summary: summarize(results), results });
}
