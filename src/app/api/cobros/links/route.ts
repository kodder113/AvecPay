import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/business/context";
import { hasFeature } from "@/lib/business/plans";
import { generateChargeCode } from "@/lib/cobros/code";
import { jsonError } from "@/lib/http";

const body = z.object({
  kind: z.enum(["pay", "tip"]),
  label: z.string().trim().max(60).optional(),
  /** Team member the QR belongs to (Team and Business plans). */
  memberUserId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).optional(),
});

/** Create a permanent QR (pay any amount, or tips). Owners and managers. */
export async function POST(req: Request) {
  const g = await requireBusiness({ roles: ["owner", "manager"], access: true });
  if (!g.ok) return g.res;
  const { db, t, user, business } = g.ctx;
  const m = business.merchant;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Datos inválidos", en: "Invalid data" }));
  const input = parsed.data;

  if (input.memberUserId) {
    if (!hasFeature(m.plan, "employee_qr")) return jsonError(402, t({ es: "Los QR por empleado están en Team y Business", en: "Per-employee QRs are on Team and Business" }));
    const { data: member } = await db.from("merchant_members").select("id").eq("merchant_id", m.id).eq("user_id", input.memberUserId).maybeSingle();
    if (!member) return jsonError(400, t({ es: "Esa persona no es de tu equipo", en: "That person isn't on your team" }));
  }
  // Starter: one permanent QR and one tip QR for the business.
  const { data: existing } = await db.from("pay_links").select("kind, member_user_id").eq("merchant_id", m.id).eq("active", true);
  const same = (existing ?? []).filter((l) => l.kind === input.kind && !l.member_user_id);
  if (!hasFeature(m.plan, "employee_qr") && same.length >= 1) {
    return jsonError(402, t({ es: "Starter incluye un QR permanente y uno de propinas. Mejora a Team para más.", en: "Starter includes one permanent QR and one tip QR. Upgrade to Team for more." }));
  }
  if ((existing ?? []).length >= 60) return jsonError(409, t({ es: "Límite de QR alcanzado", en: "QR limit reached" }));

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("pay_links")
      .insert({ merchant_id: m.id, code: generateChargeCode(), kind: input.kind, label: input.label || null, member_user_id: input.memberUserId ?? null, created_by: user.id })
      .select("id, code")
      .single();
    if (!error && data) return NextResponse.json(data, { status: 201 });
    if (error?.code !== "23505") return jsonError(500, error?.message ?? "error");
  }
  return jsonError(500, "Could not create a unique code");
}
