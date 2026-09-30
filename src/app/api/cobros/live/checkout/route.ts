import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckoutSession, toCents } from "@/lib/stripe";
import { jsonError } from "@/lib/http";
import { getT } from "@/lib/i18n/server";

const body = z.object({
  code: z.string().regex(/^[A-Za-z2-9]{8}$/),
  tip: z.number().min(0).max(1_000_000).default(0),
});

/**
 * Customer taps "Pagar con tarjeta / Apple Pay": opens a Stripe Checkout for
 * the charge plus tip. No Avec account needed. Stripe's signed webhook, not
 * this route, marks the charge paid.
 */
export async function POST(req: Request) {
  const { t } = await getT();
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Datos inválidos", en: "Invalid data" }));
  if (!process.env.STRIPE_SECRET_KEY) return jsonError(503, t({ es: "El pago con tarjeta no está disponible", en: "Card payment isn't available" }));

  const db = createAdminClient();
  const { data: charge } = await db
    .from("charges")
    .select("id, code, mode, status, amount, currency, allowed_methods, tips_allowed, expires_at, merchants(business_name)")
    .eq("code", parsed.data.code.toUpperCase())
    .maybeSingle();
  if (!charge) return jsonError(404, t({ es: "Este cobro no existe", en: "This charge doesn't exist" }));
  // Card is only on the charge if the merchant's Stripe was set up when it was created.
  if (charge.mode !== "live" || !(charge.allowed_methods as string[]).includes("card")) {
    return jsonError(400, t({ es: "Este cobro no acepta tarjeta", en: "This charge doesn't accept cards" }));
  }
  if (charge.status !== "pending") return jsonError(409, t({ es: "Este cobro ya no está pendiente", en: "This charge is no longer pending" }));
  if (new Date(charge.expires_at) < new Date()) return jsonError(409, t({ es: "Este cobro venció. Pide un nuevo QR.", en: "This charge has expired. Ask for a new QR." }));

  const amountCents = toCents(charge.amount);
  const tipCents = toCents(parsed.data.tip);
  if (tipCents < 0 || tipCents > amountCents || (tipCents > 0 && !charge.tips_allowed)) {
    return jsonError(400, t({ es: "Propina inválida", en: "Invalid tip" }));
  }

  const merchant = (Array.isArray(charge.merchants) ? charge.merchants[0] : charge.merchants) as { business_name: string } | null;
  const origin = new URL(req.url).origin;
  try {
    const session = await createCheckoutSession({
      amountCents: amountCents + tipCents,
      currency: charge.currency,
      name: `${merchant?.business_name ?? t({ es: "Comercio", en: "Merchant" })} · ${charge.code}`,
      chargeId: charge.id,
      tipCents,
      successUrl: `${origin}/pagar/${charge.code}?pagado=1`,
      cancelUrl: `${origin}/pagar/${charge.code}`,
      // Don't leave a card page open for hours after the QR is gone.
      expiresAt: Math.floor(Date.now() / 1000) + 31 * 60,
    });
    await db.from("charges").update({ stripe_session_id: session.id }).eq("id", charge.id).eq("status", "pending");
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("stripe checkout", e);
    return jsonError(502, t({ es: "No se pudo abrir el pago con tarjeta. Intenta de nuevo.", en: "Couldn't open the card payment. Try again." }));
  }
}
