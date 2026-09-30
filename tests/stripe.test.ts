import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createHmac } from "crypto";
import { stripeEnabledFor, toCents, verifyStripeSignature } from "@/lib/stripe";

describe("verifyStripeSignature", () => {
  const secret = "whsec_test";
  const payload = '{"type":"checkout.session.completed"}';
  const now = 1_800_000_000;
  const sig = (t: number, p = payload) => createHmac("sha256", secret).update(`${t}.${p}`).digest("hex");

  it("accepts a valid signature, including among several v1 values", () => {
    expect(verifyStripeSignature(payload, `t=${now},v1=${sig(now)}`, secret, { now })).toBe(true);
    expect(verifyStripeSignature(payload, `t=${now},v1=deadbeef,v1=${sig(now)}`, secret, { now })).toBe(true);
  });
  it("rejects tampering, stale timestamps and junk", () => {
    expect(verifyStripeSignature(payload + " ", `t=${now},v1=${sig(now)}`, secret, { now })).toBe(false);
    expect(verifyStripeSignature(payload, `t=${now - 3600},v1=${sig(now - 3600)}`, secret, { now })).toBe(false);
    expect(verifyStripeSignature(payload, null, secret, { now })).toBe(false);
    expect(verifyStripeSignature(payload, "garbage", secret, { now })).toBe(false);
  });
});

describe("stripeEnabledFor", () => {
  it("only for the configured owner when keys are set", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("AVEC_STRIPE_OWNER_EMAIL", "Owner@Example.com");
    expect(stripeEnabledFor("owner@example.com")).toBe(true);
    expect(stripeEnabledFor("someone@else.com")).toBe(false);
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(stripeEnabledFor("owner@example.com")).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("toCents", () => {
  it("rounds to whole cents", () => {
    expect(toCents(1)).toBe(100);
    expect(toCents("287.50")).toBe(28750);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
});
