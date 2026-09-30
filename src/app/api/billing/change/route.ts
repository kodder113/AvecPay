import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/business/context";
import { PLANS, PLAN_IDS } from "@/lib/business/plans";
import { syncSubscription, tierFor } from "@/lib/business/billing";
import { changeSubscriptionPrice, ensurePlanPrice } from "@/lib/stripe";
import { jsonError } from "@/lib/http";

const body = z.object({ plan: z.enum(PLAN_IDS) });

/** Upgrade or downgrade a paid plan (prorated by Stripe), keeping the price list. */
export async function POST(req: Request) {
  const g = await requireBusiness({ roles: ["owner"] });
  if (!g.ok) return g.res;
  const { db, t, business } = g.ctx;
  const m = business.merchant;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Datos inválidos", en: "Invalid data" }));
  if (!m.stripe_subscription_id) return jsonError(409, t({ es: "Primero suscríbete a un plan.", en: "Subscribe to a plan first." }));
  const plan = PLANS[parsed.data.plan];
  if (plan.id === m.plan) return NextResponse.json({ ok: true });
  const { count } = await db.from("merchant_members").select("id", { count: "exact", head: true }).eq("merchant_id", m.id);
  if ((count ?? 1) > plan.seats) {
    return jsonError(409, t({ es: "Tienes más usuarios de los que permite ese plan. Quita algunos en Equipo.", en: "You have more users than that plan allows. Remove some in Team." }));
  }
  try {
    const tier = await tierFor(db, m);
    const priceId = await ensurePlanPrice(plan.id, tier, plan.cents[tier], plan.name);
    const sub = await changeSubscriptionPrice(m.stripe_subscription_id, priceId, plan.id, tier);
    await syncSubscription(db, { ...sub, metadata: { ...sub.metadata, merchant_id: m.id, plan: plan.id, tier } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("billing change", e);
    return jsonError(502, t({ es: "No se pudo cambiar el plan. Intenta de nuevo.", en: "Couldn't change the plan. Try again." }));
  }
}
