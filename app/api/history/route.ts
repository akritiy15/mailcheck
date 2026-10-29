import { NextResponse } from "next/server";
import { z } from "zod";
import { getHistory, isDbEnabled } from "@/lib/db";
import { badRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

export async function GET(req: Request) {
  if (!isDbEnabled()) return NextResponse.json({ enabled: false, items: [] });

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return badRequest("Invalid query", parsed.error.issues);

  try {
    return NextResponse.json({ enabled: true, items: await getHistory(parsed.data.limit) });
  } catch (err) {
    console.error("[mailcheck] history failed:", (err as Error).message);
    return NextResponse.json({ error: "History is temporarily unavailable" }, { status: 503 });
  }
}
