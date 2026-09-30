import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/business/context";
import { visibleCharge } from "@/lib/business/visibility";
import { jsonError } from "@/lib/http";

const body = z.object({ received: z.boolean() });

/**
 * A team member confirms a payment sent from the customer's app (Zelle,
 * Venmo, Cash App, PayPal) after seeing it arrive ("Received"), or sends a
 * reported one back to waiting ("Didn't arrive").
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireBusiness();
  if (!g.ok) return g.res;
  const { db, t, user, business } = g.ctx;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Datos inválidos", en: "Invalid data" }));

  const charge = await visibleCharge<{ id: string; mode: string; paid_method: string | null; allowed_methods: string[] }>(db, business, user.id, id, "id, mode, paid_method, allowed_methods");
  if (!charge) return jsonError(404, t({ es: "Cobro no encontrado", en: "Charge not found" }));
  if (charge.mode !== "live") return jsonError(400, t({ es: "Los cobros de prueba se confirman solos", en: "Test charges confirm on their own" }));

  // Marked received without a customer report: record the first app method offered.
  const fallback = charge.allowed_methods.find((mm) => mm !== "card") ?? "zelle";
  const result = parsed.data.received
    ? await db
        .from("charges")
        .update({ status: "paid", paid_at: new Date().toISOString(), paid_method: charge.paid_method ?? fallback, paid_reference: null })
        .eq("id", id)
        .in("status", ["pending", "reported"])
        .select("id")
    : await db
        .from("charges")
        .update({ status: "pending", reported_at: null, payer_name: null, payer_user_id: null, paid_method: null, tip_amount: 0 })
        .eq("id", id)
        .eq("status", "reported")
        .select("id");
  if (result.error) return jsonError(500, result.error.message);
  if (!result.data?.length) return jsonError(409, t({ es: "El cobro cambió de estado. Actualiza la página.", en: "The charge changed status. Refresh the page." }));
  return NextResponse.json({ ok: true });
}
