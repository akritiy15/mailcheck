import { NextResponse } from "next/server";
import { z } from "zod";
import { saveResults } from "@/lib/db";
import { badRequest, clientIp, singleLimiter, tooManyRequests } from "@/lib/http";
import { verifyEmail } from "@/lib/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().trim().min(1).max(320) });

export async function POST(req: Request) {
  const rl = singleLimiter(clientIp(req));
  if (!rl.allowed) return tooManyRequests(rl);

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest("Body must be { email: string }", body.error.issues);

  const result = await verifyEmail(body.data.email);
  await saveResults([result]);
  return NextResponse.json(result, { headers: { "X-RateLimit-Remaining": String(rl.remaining) } });
}
