import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
export { applicationFeeCents, platformFeeBps } from "@/lib/business/fees";

/**
 * Minimal Stripe client (no SDK). Two roles:
 * - Avec's own account bills merchants for their plan (subscriptions).
 * - Each merchant's own Stripe account (Connect, Standard) receives their
 *   customers' card payments; Avec only takes an application fee.
 */
const API = () => (process.env.STRIPE_API_BASE ?? "https://api.stripe.com").replace(/\/$/, "");

export class StripeError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

export async function stripeRequest<T = Record<string, unknown>>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Params = {},
  opts: { account?: string | null; idempotencyKey?: string } = {},
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Stripe is not configured", 503, "not_configured");
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) form.set(k, String(v));
  const url = `${API()}${path}${method === "GET" && form.size ? `?${form}` : ""}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (method !== "GET") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (opts.account) headers["Stripe-Account"] = opts.account;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  const res = await fetch(url, { method, headers, body: method === "GET" ? undefined : form, cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: string } };
  if (!res.ok) throw new StripeError(body.error?.message ?? `Stripe error ${res.status}`, res.status, body.error?.code);
  return body;
}

// ---------------------------------------------------------------------------
// Card payments from a merchant's customers
// ---------------------------------------------------------------------------

/** Legacy single-account mode: the owner's own Stripe keys in the env vars. */
export function stripeEnabledFor(email: string | null | undefined): boolean {
  return stripeStatusFor(email) === "ok";
}

/**
 * Why legacy card mode isn't on for this user, or "ok". Names only what's
 * missing, never a value.
 */
export function stripeStatusFor(email: string | null | undefined): "ok" | "missing_key" | "missing_webhook_secret" | "missing_owner" | "not_owner" {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return "missing_key";
  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) return "missing_webhook_secret";
  const owner = process.env.AVEC_STRIPE_OWNER_EMAIL?.trim().toLowerCase();
  if (!owner) return "missing_owner";
  return email?.trim().toLowerCase() === owner ? "ok" : "not_owner";
}

export interface CheckoutInput {
  amountCents: number;
  currency: string;
  name: string;
  chargeId: string;
  tipCents: number;
  successUrl: string;
  cancelUrl: string;
  /** Unix seconds; Stripe accepts 30 minutes to 24 hours from now. */
  expiresAt?: number;
  /** The merchant's connected Stripe account; omitted in legacy mode. */
  account?: string | null;
  /** Avec's fee, only with a connected account. */
  applicationFeeCents?: number;
}

export async function createCheckoutSession(input: CheckoutInput): Promise<{ id: string; url: string }> {
  const params: Params = {
    mode: "payment",
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": input.amountCents,
    "line_items[0][price_data][product_data][name]": input.name,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.chargeId,
    "metadata[charge_id]": input.chargeId,
    "metadata[tip_cents]": input.tipCents,
    "payment_intent_data[metadata][charge_id]": input.chargeId,
    expires_at: input.expiresAt,
  };
  if (input.account && input.applicationFeeCents) {
    params["payment_intent_data[application_fee_amount]"] = input.applicationFeeCents;
    params["metadata[fee_cents]"] = input.applicationFeeCents;
  }
  const body = await stripeRequest<{ id?: string; url?: string }>("POST", "/v1/checkout/sessions", params, {
    account: input.account,
    // Same charge + amount never creates two sessions.
    idempotencyKey: `avec-${input.chargeId}-${input.amountCents}`,
  });
  if (!body.id || !body.url) throw new StripeError("Stripe returned no checkout URL", 502);
  return { id: body.id, url: body.url };
}

// ---------------------------------------------------------------------------
// Merchants' own Stripe accounts (Connect, Standard)
// ---------------------------------------------------------------------------

export interface StripeAccount {
  id: string;
  charges_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: { currently_due?: string[]; disabled_reason?: string | null };
}

export function createConnectedAccount(input: { email: string; businessName: string; merchantId: string }) {
  return stripeRequest<StripeAccount>(
    "POST",
    "/v1/accounts",
    {
      type: "standard",
      country: "US",
      email: input.email,
      "business_profile[name]": input.businessName,
      "metadata[merchant_id]": input.merchantId,
    },
    { idempotencyKey: `avec-account-${input.merchantId}` },
  );
}

export function getConnectedAccount(id: string) {
  return stripeRequest<StripeAccount>("GET", `/v1/accounts/${encodeURIComponent(id)}`);
}

export async function createAccountLink(account: string, refreshUrl: string, returnUrl: string): Promise<string> {
  const link = await stripeRequest<{ url: string }>("POST", "/v1/account_links", {
    account,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

// ---------------------------------------------------------------------------
// Merchant plans (Avec's own account)
// ---------------------------------------------------------------------------

const priceCache = new Map<string, string>();

/** The Stripe Price for a plan at a price tier, created on first use. */
export async function ensurePlanPrice(plan: string, tier: string, cents: number, planName: string): Promise<string> {
  const lookup = `avec_${plan}_${tier}_${cents}`;
  const cached = priceCache.get(lookup);
  if (cached) return cached;
  const found = await stripeRequest<{ data: { id: string }[] }>("GET", "/v1/prices", { "lookup_keys[]": lookup, active: true, limit: 1 });
  let id = found.data?.[0]?.id;
  if (!id) {
    const created = await stripeRequest<{ id: string }>(
      "POST",
      "/v1/prices",
      {
        currency: "usd",
        unit_amount: cents,
        "recurring[interval]": "month",
        lookup_key: lookup,
        "product_data[name]": `Avec ${planName}${tier === "launch" ? " (launch price)" : ""}`,
        "metadata[plan]": plan,
        "metadata[tier]": tier,
      },
      { idempotencyKey: `avec-price-${lookup}` },
    );
    id = created.id;
  }
  priceCache.set(lookup, id);
  return id;
}

/** A Stripe coupon for a discount promo code, created on first use. */
export async function ensureCoupon(code: string, percentOff: number, months: number | null): Promise<string> {
  const id = `avec_${code}`.replace(/[^A-Za-z0-9_-]/g, "_");
  try {
    await stripeRequest("GET", `/v1/coupons/${id}`);
  } catch (e) {
    if (!(e instanceof StripeError) || e.status !== 404) throw e;
    await stripeRequest("POST", "/v1/coupons", {
      id,
      percent_off: percentOff,
      duration: months ? "repeating" : "forever",
      duration_in_months: months ?? undefined,
      name: `Avec ${code}`,
    });
  }
  return id;
}

export async function createSubscriptionCheckout(input: {
  priceId: string;
  merchantId: string;
  plan: string;
  tier: string;
  email: string;
  customerId?: string | null;
  couponId?: string | null;
  /** Discount promo code, recorded as used when the subscription starts. */
  promoCode?: string | null;
  /** Start billing later (e.g. when an in-person code runs out). Unix seconds. */
  trialEnd?: number | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const params: Params = {
    mode: "subscription",
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": 1,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.merchantId,
    "metadata[merchant_id]": input.merchantId,
    "subscription_data[metadata][merchant_id]": input.merchantId,
    "subscription_data[metadata][plan]": input.plan,
    "subscription_data[metadata][tier]": input.tier,
    "subscription_data[trial_end]": input.trialEnd ?? undefined,
    "discounts[0][coupon]": input.couponId ?? undefined,
    "subscription_data[metadata][promo]": input.promoCode ?? undefined,
  };
  if (input.customerId) params.customer = input.customerId;
  else params.customer_email = input.email;
  const body = await stripeRequest<{ url?: string }>("POST", "/v1/checkout/sessions", params);
  if (!body.url) throw new StripeError("Stripe returned no checkout URL", 502);
  return body.url;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  items?: { data: { id: string; current_period_end?: number; price?: { id: string; lookup_key?: string | null; metadata?: Record<string, string> } }[] };
  metadata?: Record<string, string>;
}

export function getSubscription(id: string) {
  return stripeRequest<StripeSubscription>("GET", `/v1/subscriptions/${encodeURIComponent(id)}`);
}

export async function changeSubscriptionPrice(subscriptionId: string, priceId: string, plan: string, tier: string) {
  const sub = await getSubscription(subscriptionId);
  const item = sub.items?.data?.[0]?.id;
  if (!item) throw new StripeError("Subscription has no items", 409);
  return stripeRequest<StripeSubscription>("POST", `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    "items[0][id]": item,
    "items[0][price]": priceId,
    proration_behavior: "create_prorations",
    "metadata[plan]": plan,
    "metadata[tier]": tier,
    cancel_at_period_end: false,
  });
}

export function setCancelAtPeriodEnd(subscriptionId: string, cancel: boolean) {
  return stripeRequest<StripeSubscription>("POST", `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    cancel_at_period_end: cancel,
  });
}

export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const body = await stripeRequest<{ url: string }>("POST", "/v1/billing_portal/sessions", { customer: customerId, return_url: returnUrl });
  return body.url;
}

/** Period end of a subscription (newer API versions keep it on the item). */
export function periodEnd(sub: StripeSubscription): number | null {
  return sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

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

/** Accepts events signed by Avec's own endpoint or its Connect endpoint. */
export function verifyAnyStripeSignature(payload: string, header: string | null): boolean {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((s): s is string => Boolean(s?.trim()));
  return secrets.some((s) => verifyStripeSignature(payload, header, s.trim()));
}

export function toCents(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}
