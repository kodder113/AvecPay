import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/business/adminGuard";
import { jsonError } from "@/lib/http";

const body = z.object({ on: z.boolean(), until: z.string().nullable().optional() });

/** Launch pricing on/off, optionally with an end date. */
export async function POST(req: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.res;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, "Invalid data");
  const until = parsed.data.until ? new Date(parsed.data.until).toISOString() : null;
  const { error } = await g.db
    .from("app_settings")
    .upsert({ key: "launch_pricing", value: { on: parsed.data.on, until }, updated_at: new Date().toISOString() });
  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}
