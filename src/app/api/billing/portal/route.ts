import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/business/context";
import { createPortalSession } from "@/lib/stripe";
import { jsonError } from "@/lib/http";

/** Stripe's billing page: update card, see invoices. */
export async function POST(req: Request) {
  const g = await requireBusiness({ roles: ["owner"] });
  if (!g.ok) return g.res;
  const { t, business } = g.ctx;
  if (!business.merchant.stripe_customer_id) return jsonError(409, t({ es: "Aún no tienes pagos con tarjeta.", en: "You don't have card billing yet." }));
  try {
    const url = await createPortalSession(business.merchant.stripe_customer_id, `${new URL(req.url).origin}/cobrar/plan`);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("billing portal", e);
    return jsonError(502, t({ es: "No se pudo abrir la página de facturación.", en: "Couldn't open the billing page." }));
  }
}
