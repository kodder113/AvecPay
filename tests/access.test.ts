import { describe, expect, it } from "vitest";
import { accessState } from "@/lib/business/access";
import { applicationFeeCents } from "@/lib/business/fees";

const now = new Date("2026-10-01T12:00:00Z");
const base = { plan: "team", subscription_status: "none", access_until: null, past_due_since: null };

describe("accessState", () => {
  it("needs a plan", () => {
    expect(accessState({ ...base, plan: null }, now).ok).toBe(false);
    expect(accessState(base, now)).toEqual({ ok: false, reason: "no_plan" });
  });
  it("active subscriptions and comped accounts (no end or future end)", () => {
    expect(accessState({ ...base, subscription_status: "active" }, now).ok).toBe(true);
    expect(accessState({ ...base, subscription_status: "comped" }, now).ok).toBe(true);
    expect(accessState({ ...base, subscription_status: "comped", access_until: "2026-11-01T00:00:00Z" }, now).ok).toBe(true);
    expect(accessState({ ...base, subscription_status: "comped", access_until: "2026-09-01T00:00:00Z" }, now)).toEqual({ ok: false, reason: "expired" });
  });
  it("trials end on their date", () => {
    expect(accessState({ ...base, subscription_status: "trialing", access_until: "2026-10-05T00:00:00Z" }, now).ok).toBe(true);
    expect(accessState({ ...base, subscription_status: "trialing", access_until: null }, now).ok).toBe(false);
  });
  it("gives 7 days of grace after a failed payment", () => {
    expect(accessState({ ...base, subscription_status: "past_due", past_due_since: "2026-09-28T12:00:00Z" }, now).reason).toBe("grace");
    expect(accessState({ ...base, subscription_status: "past_due", past_due_since: "2026-09-20T12:00:00Z" }, now)).toEqual({ ok: false, reason: "past_due" });
  });
  it("canceled keeps access until the paid period ends", () => {
    expect(accessState({ ...base, subscription_status: "canceled", access_until: "2026-10-10T00:00:00Z" }, now).ok).toBe(true);
    expect(accessState({ ...base, subscription_status: "canceled", access_until: "2026-09-10T00:00:00Z" }, now).ok).toBe(false);
  });
});

describe("applicationFeeCents", () => {
  it("is 0.5% by default, rounded, never negative", () => {
    expect(applicationFeeCents(10000)).toBe(50);
    expect(applicationFeeCents(100)).toBe(1);
    expect(applicationFeeCents(99)).toBe(0);
    expect(applicationFeeCents(12345, 75)).toBe(93);
  });
});
