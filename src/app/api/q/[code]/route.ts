import { NextResponse } from "next/server";
import { z } from "zod";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MERCHANT_COLUMNS, type MerchantRow } from "@/lib/business/context";
import { accessState } from "@/lib/business/access";
import { chargeMethods, insertCharge } from "@/lib/business/charges";
import { jsonError } from "@/lib/http";

const body = z.object({ amount: z.coerce.number().positive().max(50_000).multipleOf(0.01) });

/**
 * A customer typed an amount on a permanent QR: create a one-time charge for
 * it and send them to the normal payment page. No account needed.
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { t } = await getT();
  const { code } = await params;
  if (!/^[A-Za-z2-9]{8}$/.test(code)) return jsonError(404, t({ es: "QR no encontrado", en: "QR not found" }));
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Escribe un monto válido", en: "Enter a valid amount" }));
  const db = createAdminClient();
  const { data: link } = await db
    .from("pay_links")
    .select(`id, kind, label, active, member_user_id, created_by, merchants (${MERCHANT_COLUMNS})`)
    .eq("code", code.toUpperCase())
    .maybeSingle();
  const merchant = (link && (Array.isArray(link.merchants) ? link.merchants[0] : link.merchants)) as MerchantRow | null;
  if (!link || !link.active || !merchant) return jsonError(404, t({ es: "Este QR ya no está activo", en: "This QR is no longer active" }));
  if (!accessState(merchant).ok) return jsonError(409, t({ es: "Este negocio no está aceptando pagos ahora.", en: "This business isn't accepting payments right now." }));

  const allowed = await chargeMethods(db, merchant);
  if (!allowed.length) return jsonError(409, t({ es: "Este negocio no tiene métodos de pago activos.", en: "This business has no payment methods turned on." }));
  const tip = link.kind === "tip";
  const charge = await insertCharge(db, merchant, allowed, {
    amount: parsed.data.amount,
    description: tip ? (link.label ? t({ es: `Propina · ${link.label}`, en: `Tip · ${link.label}` }) : t({ es: "Propina", en: "Tip" })) : (link.label ?? null),
    kind: "link",
    createdBy: link.member_user_id ?? link.created_by,
    payLinkId: link.id,
    tipOnly: tip,
    validMinutes: 30,
  });
  return NextResponse.json({ code: charge.code }, { status: 201 });
}
