import { toCents } from "@/lib/stripe";

/** The parts of a Stripe Checkout Session the webhook relies on. */
export interface StripeSession {
  id: string;
  payment_status?: string;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | null;
  metadata?: Record<string, string> | null;
  customer_details?: { name?: string | null } | null;
}

export interface ChargeForStripe {
  id: string;
  status: string;
  amount: number | string;
  currency: string;
}

export type StripeOutcome =
  | { ok: true; update: { status: "paid"; paid_method: "card"; tip_amount: number; paid_reference: string; payer_name: string; paid_at: string; stripe_session_id: string } }
  | { ok: false; reason: string };

/**
 * Decides whether a paid Checkout Session settles a charge. The amount Stripe
 * collected must equal the charge plus the tip we priced into the session.
 */
export function settleFromSession(session: StripeSession, charge: ChargeForStripe, now = new Date()): StripeOutcome {
  if (session.payment_status !== "paid") return { ok: false, reason: "not_paid" };
  if (session.metadata?.charge_id !== charge.id) return { ok: false, reason: "wrong_charge" };
  if (charge.status === "paid") return { ok: false, reason: "already_paid" };
  const tipCents = Number(session.metadata?.tip_cents ?? "0");
  const amountCents = toCents(charge.amount);
  if (!Number.isInteger(tipCents) || tipCents < 0 || tipCents > amountCents) return { ok: false, reason: "bad_tip" };
  if (session.amount_total !== amountCents + tipCents) return { ok: false, reason: "amount_mismatch" };
  if ((session.currency ?? "").toUpperCase() !== charge.currency.toUpperCase()) return { ok: false, reason: "currency_mismatch" };
  return {
    ok: true,
    update: {
      status: "paid",
      paid_method: "card",
      tip_amount: tipCents / 100,
      paid_reference: session.payment_intent ?? session.id,
      payer_name: session.customer_details?.name?.trim().slice(0, 60) || "Cliente",
      paid_at: now.toISOString(),
      stripe_session_id: session.id,
    },
  };
}
