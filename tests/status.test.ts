import { describe, expect, it } from "vitest";
import { transitionPath } from "@/lib/status";
import { mapMoonPaySellStatus } from "@/lib/providers/moonpay/status";

describe("mapMoonPaySellStatus", () => {
  it("maps documented MoonPay sell statuses", () => {
    expect(mapMoonPaySellStatus({ status: "waitingForDeposit" })).toBe("awaiting_usdt");
    expect(mapMoonPaySellStatus({ status: "pending", depositHash: null })).toBe("awaiting_usdt");
    expect(mapMoonPaySellStatus({ status: "pending", depositHash: "0xabc" })).toBe("processing");
    expect(mapMoonPaySellStatus({ status: "completed" })).toBe("completed");
    expect(mapMoonPaySellStatus({ status: "failed" })).toBe("failed");
  });
  it("does not guess on unknown statuses", () => {
    expect(mapMoonPaySellStatus({ status: "somethingNew" })).toBe("created");
  });
});

describe("transitionPath", () => {
  it("fills in skipped steps", () => {
    expect(transitionPath("awaiting_usdt", "processing")).toEqual(["usdt_received", "processing"]);
    expect(transitionPath("processing", "completed")).toEqual(["payout_initiated", "completed"]);
  });
  it("never regresses or leaves a terminal state", () => {
    expect(transitionPath("processing", "awaiting_usdt")).toEqual([]);
    expect(transitionPath("completed", "failed")).toEqual([]);
    expect(transitionPath("failed", "completed")).toEqual([]);
  });
  it("can fail from any non-terminal state", () => {
    expect(transitionPath("awaiting_usdt", "failed")).toEqual(["failed"]);
  });
});
