import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Minimal Stripe client (no SDK): Checkout Sessions and webhook signatures.
 * Card and Apple Pay live payments go to the Stripe account in the env vars,
 * which is the owner's own account for now (Stripe Connect comes later).
 */
const API = () => (process.env.STRIPE_API_BASE ?? "https://api.stripe.com").replace(/\/$/, "");

/** Stripe is set up, and this merchant (by owner email) may use it. */
export function stripeEnabledFor(email: string | null | undefined): boolean {
  const owner = process.env.AVEC_STRIPE_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && owner && email?.toLowerCase() === owner);
}

export interface CheckoutInput {
  amountCents: number;
  currency: string;
  name: string;
  chargeId: string;
  tipCents: number;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(input: CheckoutInput): Promise<{ id: string; url: string }> {
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amountCents),
    "line_items[0][price_data][product_data][name]": input.name,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.chargeId,
    "metadata[charge_id]": input.chargeId,
    "metadata[tip_cents]": String(input.tipCents),
    "payment_intent_data[metadata][charge_id]": input.chargeId,
  });
  const res = await fetch(`${API()}/v1/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Same charge + amount never creates two sessions.
      "Idempotency-Key": `avec-${input.chargeId}-${input.amountCents}`,
    },
    body: form,
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !body.id || !body.url) throw new Error(body.error?.message ?? `Stripe error ${res.status}`);
  return { id: body.id, url: body.url };
}

/**
 * Verifies a Stripe-Signature header: t=<unix>,v1=<hex>[,v1=…], where
 * v1 = HMAC-SHA256(webhook secret, `${t}.${payload}`).
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  opts: { toleranceSeconds?: number; now?: number } = {},
): boolean {
  if (!header || !secret) return false;
  let t: string | null = null;
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") t = v;
    if (k === "v1" && v) sigs.push(v);
  }
  if (!t || !/^\d+$/.test(t) || !sigs.length) return false;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > (opts.toleranceSeconds ?? 300)) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex"));
  return sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export function toCents(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}
