import { describe, expect, it } from "vitest";
import { change, computeStats, type StatCharge } from "@/lib/business/insights";

const now = new Date("2026-10-01T18:00:00Z");
const c = (o: Partial<StatCharge>): StatCharge => ({
  amount: 100,
  tip_amount: 0,
  tip_only: false,
  status: "paid",
  paid_method: "card",
  paid_at: "2026-10-01T15:00:00Z",
  created_at: "2026-10-01T15:00:00Z",
  created_by: "u1",
  kind: "quick",
  ...o,
});

describe("computeStats", () => {
  const stats = computeStats(
    [
      c({ amount: 100, tip_amount: 15 }),
      c({ amount: 300, created_by: "u2", paid_method: "zelle" }),
      c({ amount: 10, tip_only: true, created_by: "u2", paid_method: "venmo" }),
      c({ amount: 50, paid_at: "2026-09-20T15:00:00Z" }),
      c({ amount: 999, status: "pending", paid_at: null }),
    ],
    now,
    14,
    "America/New_York",
  );
  it("totals today, with tips and tip-only QRs, excluding unpaid", () => {
    expect(stats.today).toEqual({ total: 425, count: 3, tips: 25, avg: 200 });
    expect(stats.week.total).toBe(425);
    expect(stats.prevWeek.total).toBe(50);
    expect(stats.month.count).toBe(4);
  });
  it("splits by team member and method", () => {
    expect(stats.members.map((m) => [m.userId, m.total, m.tips])).toEqual([
      ["u2", 310, 10],
      ["u1", 165, 15],
    ]);
    expect(stats.methods[0]).toEqual({ method: "zelle", total: 300, count: 1 });
    expect(stats.methods.find((m) => m.method === "card")).toEqual({ method: "card", total: 165, count: 2 });
  });
  it("fills every day of the chart", () => {
    expect(stats.daily).toHaveLength(14);
    expect(stats.daily.at(-1)).toEqual({ date: "2026-10-01", total: 425, count: 3 });
  });
  it("change is a percent or null", () => {
    expect(change(150, 100)).toBe(50);
    expect(change(5, 0)).toBeNull();
  });
});
