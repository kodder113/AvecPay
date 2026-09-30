import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/business/context";
import { PLANS, PLAN_IDS } from "@/lib/business/plans";
import { peekPromo, tierFor } from "@/lib/business/billing";
import { createSubscriptionCheckout, ensureCoupon, ensurePlanPrice, StripeError } from "@/lib/stripe";
import { jsonError } from "@/lib/http";
import { promoErrorMessage } from "@/lib/business/messages";

const body = z.object({ plan: z.enum(PLAN_IDS), code: z.string().max(40).optional() });

/**
 * Owner starts (or restarts) their Avec plan on Stripe Checkout. A discount
 * code is applied there. If time is already covered by an in-person code,
 * billing starts when that time runs out.
 */
export async function POST(req: Request) {
  const g = await requireBusiness({ roles: ["owner"] });
  if (!g.ok) return g.res;
  const { db, t, user, business } = g.ctx;
  const m = business.merchant;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Datos inválidos", en: "Invalid data" }));
  if (m.subscription_status === "active" && m.stripe_subscription_id) {
    return jsonError(409, t({ es: "Ya tienes un plan activo. Usa “Cambiar plan”.", en: "You already have an active plan. Use “Change plan”." }));
  }

  // Downgrades can't leave more people than the plan allows.
  const { count } = await db.from("merchant_members").select("id", { count: "exact", head: true }).eq("merchant_id", m.id);
  if ((count ?? 1) > PLANS[parsed.data.plan].seats) {
    return jsonError(409, t({ es: "Tienes más usuarios de los que permite ese plan. Quita algunos en Equipo.", en: "You have more users than that plan allows. Remove some in Team." }));
  }

  let couponId: string | null = null;
  let promoCode: string | null = null;
  if (parsed.data.code?.trim()) {
    const peek = await peekPromo(db, parsed.data.code, m.id);
    if (!peek.ok) return jsonError(400, promoErrorMessage(peek.error, t));
    if (peek.promo.kind !== "discount") return jsonError(400, t({ es: "Ese código se canjea con “Tengo un código”.", en: "Redeem that code with “I have a code”." }));
    couponId = await ensureCoupon(peek.promo.code, peek.promo.percent_off ?? 0, peek.promo.months);
    promoCode = peek.promo.code;
  }

  const tier = await tierFor(db, m);
  const plan = PLANS[parsed.data.plan];
  const origin = new URL(req.url).origin;
  // Time already covered by a code (same plan): first charge when it ends.
  const covered = m.access_until && new Date(m.access_until).getTime() > Date.now() + 48 * 3600_000 && m.plan === plan.id ? m.access_until : null;
  try {
    const priceId = await ensurePlanPrice(plan.id, tier, plan.cents[tier], plan.name);
    const url = await createSubscriptionCheckout({
      priceId,
      merchantId: m.id,
      plan: plan.id,
      tier,
      email: user.email ?? "",
      customerId: m.stripe_customer_id,
      couponId,
      promoCode,
      trialEnd: covered ? Math.floor(new Date(covered).getTime() / 1000) : null,
      successUrl: `${origin}/cobrar/plan?activado=1`,
      cancelUrl: `${origin}/cobrar/plan`,
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("billing checkout", e);
    if (e instanceof StripeError && e.code === "not_configured") return jsonError(503, t({ es: "Los pagos de planes aún no están configurados.", en: "Plan payments aren't set up yet." }));
    return jsonError(502, t({ es: "No se pudo abrir el pago. Intenta de nuevo.", en: "Couldn't open the payment page. Try again." }));
  }
}
