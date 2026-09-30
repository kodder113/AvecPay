import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicationFeeCents, createCheckoutSession, toCents } from "@/lib/stripe";
import { accessState, type BillingFields } from "@/lib/business/access";
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
    .select(
      "id, code, mode, status, amount, currency, allowed_methods, tips_allowed, tip_only, expires_at, merchants(business_name, stripe_account_id, stripe_charges_enabled, plan, subscription_status, access_until, past_due_since)",
    )
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

  const merchant = (Array.isArray(charge.merchants) ? charge.merchants[0] : charge.merchants) as
    | (BillingFields & { business_name: string; stripe_account_id: string | null; stripe_charges_enabled: boolean })
    | null;
  if (!merchant || !accessState(merchant).ok) return jsonError(409, t({ es: "Este negocio no está aceptando pagos ahora.", en: "This business isn't accepting payments right now." }));
  // The merchant's own Stripe account gets the money; Avec takes its fee (never on tips).
  const account = merchant.stripe_account_id && merchant.stripe_charges_enabled ? merchant.stripe_account_id : null;
  const feeCents = account && !charge.tip_only ? applicationFeeCents(amountCents) : 0;
  const origin = new URL(req.url).origin;
  const now = Math.floor(Date.now() / 1000);
  // Tickets stay open for days, but a Stripe page lasts 30 minutes to 24 hours.
  const expiresAt = Math.min(now + 24 * 3600 - 60, Math.max(now + 31 * 60, Math.floor(new Date(charge.expires_at).getTime() / 1000)));
  try {
    const session = await createCheckoutSession({
      amountCents: amountCents + tipCents,
      currency: charge.currency,
      name: `${merchant?.business_name ?? t({ es: "Comercio", en: "Merchant" })} · ${charge.code}`,
      chargeId: charge.id,
      tipCents,
      successUrl: `${origin}/pagar/${charge.code}?pagado=1`,
      cancelUrl: `${origin}/pagar/${charge.code}`,
      expiresAt,
      account,
      applicationFeeCents: feeCents,
    });
    await db.from("charges").update({ stripe_session_id: session.id }).eq("id", charge.id).eq("status", "pending");
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("stripe checkout", e);
    return jsonError(502, t({ es: "No se pudo abrir el pago con tarjeta. Intenta de nuevo.", en: "Couldn't open the card payment. Try again." }));
  }
}
