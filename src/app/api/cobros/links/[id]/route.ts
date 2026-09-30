import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/business/context";
import { jsonError } from "@/lib/http";

const body = z.object({ active: z.boolean().optional(), label: z.string().trim().max(60).optional() });

/** Turn a permanent QR off (or back on), or rename it. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireBusiness({ roles: ["owner", "manager"] });
  if (!g.ok) return g.res;
  const { db, t, business } = g.ctx;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Datos inválidos", en: "Invalid data" }));
  const update: Record<string, unknown> = {};
  if (parsed.data.active !== undefined) update.active = parsed.data.active;
  if (parsed.data.label !== undefined) update.label = parsed.data.label || null;
  const { data, error } = await db.from("pay_links").update(update).eq("id", id).eq("merchant_id", business.merchant.id).select("id");
  if (error) return jsonError(500, error.message);
  if (!data?.length) return jsonError(404, t({ es: "QR no encontrado", en: "QR not found" }));
  return NextResponse.json({ ok: true });
}
