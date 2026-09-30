import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { settleFromSession, type StripeSession } from "@/lib/cobros/stripePay";

const charge = { id: "c1", status: "pending", amount: "1.00", currency: "USD" };
const session = (over: Partial<StripeSession> = {}): StripeSession => ({
  id: "cs_test_1",
  payment_status: "paid",
  amount_total: 120,
  currency: "usd",
  payment_intent: "pi_1",
  metadata: { charge_id: "c1", tip_cents: "20" },
  customer_details: { name: "Wilmer" },
  ...over,
});

describe("settleFromSession", () => {
  it("settles a paid session for charge + tip", () => {
    const r = settleFromSession(session(), charge, new Date("2026-09-30T12:00:00Z"));
    expect(r).toEqual({
      ok: true,
      update: {
        status: "paid",
        paid_method: "card",
        tip_amount: 0.2,
        paid_reference: "pi_1",
        payer_name: "Wilmer",
        paid_at: "2026-09-30T12:00:00.000Z",
        stripe_session_id: "cs_test_1",
      },
    });
  });

  it("settles a reported, cancelled or expired charge, since the money was collected", () => {
    for (const status of ["reported", "cancelled"]) expect(settleFromSession(session(), { ...charge, status }).ok).toBe(true);
  });

  it("rejects unpaid, already paid, other charge, wrong amount, bad tip and currency", () => {
    const reason = (s: StripeSession, c = charge) => {
      const r = settleFromSession(s, c);
      return r.ok ? "ok" : r.reason;
    };
    expect(reason(session({ payment_status: "unpaid" }))).toBe("not_paid");
    expect(reason(session(), { ...charge, status: "paid" })).toBe("already_paid");
    expect(reason(session({ metadata: { charge_id: "c2", tip_cents: "20" } }))).toBe("wrong_charge");
    expect(reason(session({ amount_total: 100 }))).toBe("amount_mismatch");
    expect(reason(session({ metadata: { charge_id: "c1", tip_cents: "500" }, amount_total: 600 }))).toBe("bad_tip");
    expect(reason(session({ metadata: { charge_id: "c1", tip_cents: "-5" }, amount_total: 95 }))).toBe("bad_tip");
    expect(reason(session({ currency: "hnl" }))).toBe("currency_mismatch");
  });

  it("falls back to 'Cliente' without a name", () => {
    const r = settleFromSession(session({ customer_details: null }), charge);
    expect(r.ok && r.update.payer_name).toBe("Cliente");
  });
});
