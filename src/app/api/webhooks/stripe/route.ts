import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeSignature } from "@/lib/stripe";
import { settleFromSession, type StripeSession } from "@/lib/cobros/stripePay";

export const dynamic = "force-dynamic";

/**
 * Stripe → Avec: a Checkout Session was paid. Only a correctly signed event
 * whose amount matches the charge + tip marks the charge paid.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(raw) as { type: string; data: { object: StripeSession } };
  // Cards and Apple Pay complete at once; bank-style methods succeed later.
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ received: true });
  }
  const session = event.data.object;
  const chargeId = session.metadata?.charge_id;
  if (!chargeId) return NextResponse.json({ received: true, ignored: "no_charge" });

  const db = createAdminClient();
  const { data: charge, error } = await db.from("charges").select("id, status, amount, currency").eq("id", chargeId).maybeSingle();
  if (error) return NextResponse.json({ error: "db" }, { status: 500 }); // Stripe retries
  if (!charge) return NextResponse.json({ received: true, ignored: "unknown_charge" });

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
