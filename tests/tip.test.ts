import { describe, expect, it } from "vitest";
import { addMoney, parseTip, tipForPercent } from "@/lib/cobros/tip";

describe("tipForPercent", () => {
  it("computes 10/15/20% to the cent", () => {
    expect(tipForPercent(250, 10)).toBe(25);
    expect(tipForPercent(250, 15)).toBe(37.5);
    expect(tipForPercent(80.5, 15)).toBe(12.08); // 12.075 rounds half up
    expect(tipForPercent("99.99", 20)).toBe(20);
  });
});

describe("parseTip", () => {
  it("accepts blank, whole and 2-decimal amounts (comma or dot)", () => {
    expect(parseTip("", 100)).toBe(0);
    expect(parseTip("20", 100)).toBe(20);
    expect(parseTip("12,5", 100)).toBe(12.5);
    expect(parseTip("12.55", 100)).toBe(12.55);
  });
  it("rejects junk, too many decimals, negatives and tips above the charge", () => {
    expect(parseTip("abc", 100)).toBeNull();
    expect(parseTip("1.234", 100)).toBeNull();
    expect(parseTip("-5", 100)).toBeNull();
    expect(parseTip("101", 100)).toBeNull();
  });
});

describe("addMoney", () => {
  it("adds without float drift", () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(addMoney("80.50", 12.08)).toBe(92.58);
  });
});
