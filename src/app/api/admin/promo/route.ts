import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/business/adminGuard";
import { PLAN_IDS } from "@/lib/business/plans";
import { normalizeCode } from "@/lib/business/billing";
import { jsonError } from "@/lib/http";

const create = z
  .object({
    code: z.string().min(3).max(32),
    kind: z.enum(["activation", "trial", "discount"]),
    plan: z.enum(PLAN_IDS).optional(),
    months: z.coerce.number().int().min(1).max(36).optional(),
    days: z.coerce.number().int().min(1).max(365).optional(),
    percentOff: z.coerce.number().int().min(1).max(100).optional(),
    maxUses: z.coerce.number().int().min(1).max(100000).optional(),
    expiresAt: z.string().optional(),
    note: z.string().max(200).optional(),
  })
  .refine((v) => v.kind !== "activation" || (v.plan && v.months), "Activation codes need a plan and months")
  .refine((v) => v.kind !== "trial" || (v.plan && v.days), "Trial codes need a plan and days")
  .refine((v) => v.kind !== "discount" || v.percentOff, "Discount codes need a percent");

/** Create a promo code. */
export async function POST(req: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.res;
  const parsed = create.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid code");
  const v = parsed.data;
  const code = normalizeCode(v.code);
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) return jsonError(400, "Codes use letters, numbers and dashes (3–32).");
  const { error } = await g.db.from("promo_codes").insert({
    code,
    kind: v.kind,
    plan: v.kind === "discount" ? null : v.plan,
    months: v.kind === "trial" ? null : (v.months ?? null),
    days: v.kind === "trial" ? v.days : null,
    percent_off: v.kind === "discount" ? v.percentOff : null,
    max_uses: v.maxUses ?? null,
    expires_at: v.expiresAt ? new Date(v.expiresAt).toISOString() : null,
    note: v.note || null,
    created_by: g.user.id,
  });
  if (error) return jsonError(error.code === "23505" ? 409 : 500, error.code === "23505" ? "That code already exists." : error.message);
  return NextResponse.json({ code }, { status: 201 });
}

/** Turn a code on or off. */
export async function PATCH(req: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.res;
  const parsed = z.object({ code: z.string(), active: z.boolean() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, "Invalid data");
  const { error } = await g.db.from("promo_codes").update({ active: parsed.data.active }).eq("code", normalizeCode(parsed.data.code));
  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}
