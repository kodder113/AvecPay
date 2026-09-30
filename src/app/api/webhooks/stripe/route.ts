import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscription, verifyAnyStripeSignature, type StripeAccount, type StripeSubscription } from "@/lib/stripe";
import { settleFromSession, type StripeSession } from "@/lib/cobros/stripePay";
import { syncSubscription } from "@/lib/business/billing";

export const dynamic = "force-dynamic";

interface StripeEvent {
  type: string;
  /** Set when the event comes from a merchant's connected account. */
  account?: string;
  data: { object: Record<string, unknown> };
}

/**
 * Stripe → Avec. Only correctly signed events (Avec's endpoint or its
 * Connect endpoint) are used:
 * - a customer paid a charge by card (merchant's account or legacy owner mode);
 * - a merchant's Avec plan started, changed, failed or ended;
 * - a merchant's connected Stripe account changed status.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyAnyStripeSignature(raw, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(raw) as StripeEvent;
  const db = createAdminClient();
  const obj = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (obj.mode === "subscription") {
          if (typeof obj.subscription === "string") {
            const sub = await getSubscription(obj.subscription);
            await syncSubscription(db, sub);
            await recordPromoRedemption(db, sub);
          }
          return NextResponse.json({ received: true });
        }
        return await settleCharge(db, obj as unknown as StripeSession, event.account);
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(db, obj as unknown as StripeSubscription);
        return NextResponse.json({ received: true });
      case "invoice.payment_failed":
      case "invoice.paid": {
        const subId = typeof obj.subscription === "string" ? obj.subscription : null;
        if (subId) await syncSubscription(db, await getSubscription(subId));
        return NextResponse.json({ received: true });
      }
      case "account.updated": {
        const acct = obj as unknown as StripeAccount;
        await db
          .from("merchants")
          .update({ stripe_charges_enabled: Boolean(acct.charges_enabled), stripe_details_submitted: Boolean(acct.details_submitted) })
          .eq("stripe_account_id", acct.id);
        return NextResponse.json({ received: true });
      }
      default:
        return NextResponse.json({ received: true });
    }
  } catch (e) {
    console.error("stripe webhook", event.type, e);
    return NextResponse.json({ error: "processing" }, { status: 500 }); // Stripe retries
  }
}

async function settleCharge(db: ReturnType<typeof createAdminClient>, session: StripeSession, account?: string) {
  const chargeId = session.metadata?.charge_id;
  if (!chargeId) return NextResponse.json({ received: true, ignored: "no_charge" });
  const { data: charge, error } = await db
    .from("charges")
    .select("id, status, amount, currency, merchants(stripe_account_id)")
    .eq("id", chargeId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  if (!charge) return NextResponse.json({ received: true, ignored: "unknown_charge" });
  // A payment on a connected account must belong to that merchant's account.
  const merchant = (Array.isArray(charge.merchants) ? charge.merchants[0] : charge.merchants) as { stripe_account_id: string | null } | null;
  if (account && merchant?.stripe_account_id !== account) {
    console.error("stripe webhook: account mismatch", chargeId);
    return NextResponse.json({ received: true, ignored: "account_mismatch" });
  }

  const outcome = settleFromSession(session, charge);
  if (!outcome.ok) {
    if (outcome.reason !== "already_paid" && outcome.reason !== "not_paid") console.error("stripe webhook", chargeId, outcome.reason);
    return NextResponse.json({ received: true, ignored: outcome.reason });
  }
  // The money was collected, so it counts even if the QR expired or was cancelled meanwhile.
  const { error: upErr } = await db.from("charges").update(outcome.update).eq("id", charge.id).neq("status", "paid");
  if (upErr) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ received: true });
}

/** A discount code used at checkout counts as redeemed once the plan starts. */
async function recordPromoRedemption(db: ReturnType<typeof createAdminClient>, sub: StripeSubscription) {
  const code = sub.metadata?.promo;
  const merchantId = sub.metadata?.merchant_id;
  if (!code || !merchantId) return;
  const { error } = await db.rpc("redeem_promo", { p_code: code, p_merchant: merchantId });
  if (error && !error.message.includes("promo_already_used")) console.error("promo redeem", code, error.message);
}
