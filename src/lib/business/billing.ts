import "server-only";
import type { Db, MerchantRow } from "./context";
import { isPlanId, type PlanId, type PriceTier } from "./plans";
import { periodEnd, type StripeSubscription } from "@/lib/stripe";

/** Launch prices are on until switched off in the admin page, or until a date. */
export async function launchPricing(db: Db): Promise<{ on: boolean; until: string | null }> {
  const { data } = await db.from("app_settings").select("value").eq("key", "launch_pricing").maybeSingle();
  const v = (data?.value ?? { on: true, until: null }) as { on?: boolean; until?: string | null };
  const on = v.on !== false && (!v.until || new Date(v.until) > new Date());
  return { on, until: v.until ?? null };
}

export async function currentTier(db: Db): Promise<PriceTier> {
  return (await launchPricing(db)).on ? "launch" : "regular";
}

/** A merchant keeps the price list they first activated on, for life. */
export async function tierFor(db: Db, merchant: Pick<MerchantRow, "price_tier">): Promise<PriceTier> {
  return merchant.price_tier ?? (await currentTier(db));
}

export interface PromoRow {
  code: string;
  kind: "activation" | "trial" | "discount";
  plan: PlanId | null;
  months: number | null;
  days: number | null;
  percent_off: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
}

export type PromoError = "promo_invalid" | "promo_expired" | "promo_used_up" | "promo_already_used" | "already_subscribed" | "trial_used";

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** Checks a code without using it. */
export async function peekPromo(db: Db, code: string, merchantId: string): Promise<{ ok: true; promo: PromoRow } | { ok: false; error: PromoError }> {
  const c = normalizeCode(code);
  if (!/^[A-Z0-9-]{3,32}$/.test(c)) return { ok: false, error: "promo_invalid" };
  const { data } = await db.from("promo_codes").select("*").eq("code", c).maybeSingle();
  const promo = data as PromoRow | null;
  if (!promo || !promo.active) return { ok: false, error: "promo_invalid" };
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) return { ok: false, error: "promo_expired" };
  if (promo.max_uses != null && promo.used_count >= promo.max_uses) return { ok: false, error: "promo_used_up" };
  const { data: used } = await db.from("promo_redemptions").select("id").eq("code", c).eq("merchant_id", merchantId).maybeSingle();
  if (used) return { ok: false, error: "promo_already_used" };
  return { ok: true, promo };
}

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * Activation and trial codes turn a plan on without a card (paid in person,
 * or a free trial). Discount codes are applied at checkout instead.
 */
export async function redeemAccessCode(db: Db, merchant: MerchantRow, code: string): Promise<{ ok: true; promo: PromoRow } | { ok: false; error: PromoError }> {
  const peek = await peekPromo(db, code, merchant.id);
  if (!peek.ok) return peek;
  const promo = peek.promo;
  if (promo.kind === "discount") return { ok: true, promo };
  if (merchant.subscription_status === "active") return { ok: false, error: "already_subscribed" };
  if (promo.kind === "trial" && merchant.subscription_status !== "none") return { ok: false, error: "trial_used" };

  const { error } = await db.rpc("redeem_promo", { p_code: promo.code, p_merchant: merchant.id });
  if (error) {
    const known: PromoError[] = ["promo_invalid", "promo_expired", "promo_used_up", "promo_already_used"];
    return { ok: false, error: known.find((k) => error.message.includes(k)) ?? "promo_invalid" };
  }

  const now = new Date();
  // Stack on top of time already paid for.
  const base = merchant.access_until && new Date(merchant.access_until) > now ? new Date(merchant.access_until) : now;
  const until = promo.kind === "activation" ? addMonths(base, promo.months ?? 1) : new Date(now.getTime() + (promo.days ?? 30) * 86_400_000);
  await db
    .from("merchants")
    .update({
      plan: promo.plan,
      subscription_status: promo.kind === "activation" ? "comped" : "trialing",
      access_until: until.toISOString(),
      past_due_since: null,
      price_tier: merchant.price_tier ?? (await currentTier(db)),
    })
    .eq("id", merchant.id);
  return { ok: true, promo };
}

const STATUS_MAP: Record<string, string> = {
  active: "active",
  trialing: "active", // a paid subscription whose first charge is scheduled (e.g. after a code runs out)
  past_due: "past_due",
  unpaid: "past_due",
  incomplete: "none",
  incomplete_expired: "none",
  canceled: "canceled",
  paused: "canceled",
};

/**
 * Mirrors a Stripe subscription onto the merchant (from webhooks and after
 * plan changes). Finds the merchant by metadata or by Stripe customer.
 */
export async function syncSubscription(db: Db, sub: StripeSubscription): Promise<boolean> {
  const merchantId = sub.metadata?.merchant_id;
  const query = db.from("merchants").select("id, access_until, subscription_status, past_due_since, price_tier");
  const { data: merchant } = merchantId ? await query.eq("id", merchantId).maybeSingle() : await query.eq("stripe_customer_id", sub.customer).maybeSingle();
  if (!merchant) return false;

  const item = sub.items?.data?.[0];
  const planFromPrice = item?.price?.metadata?.plan ?? item?.price?.lookup_key?.split("_")[1];
  const plan = isPlanId(sub.metadata?.plan) ? sub.metadata!.plan : isPlanId(planFromPrice) ? planFromPrice : undefined;
  const tier = sub.metadata?.tier === "regular" || sub.metadata?.tier === "launch" ? sub.metadata.tier : undefined;
  const status = STATUS_MAP[sub.status] ?? "none";
  const end = periodEnd(sub);

  const update: Record<string, unknown> = {
    stripe_customer_id: sub.customer,
    stripe_subscription_id: status === "canceled" ? null : sub.id,
    subscription_status: status,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    access_until: end ? new Date(end * 1000).toISOString() : merchant.access_until,
    past_due_since: status === "past_due" ? (merchant.past_due_since ?? new Date().toISOString()) : null,
  };
  if (plan) update.plan = plan;
  if (tier && !merchant.price_tier) update.price_tier = tier;
  await db.from("merchants").update(update).eq("id", merchant.id);
  return true;
}
