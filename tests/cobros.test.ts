import { describe, expect, it } from "vitest";
import { resolveMethods } from "@/lib/cobros/methods";
import { formatDateTime, formatMoney, parseChargeCode, payErrorMessage } from "@/lib/cobros/parse";
import { generateChargeCode } from "@/lib/cobros/code";

describe("resolveMethods", () => {
  it("offers only what both the partner and the merchant allow, in catalog order", () => {
    const bankPartner = ["bank_transfer", "card", "tigo_money"]; // fiat-only white-label
    expect(resolveMethods(bankPartner, ["lightning", "card", "bank_transfer"])).toEqual(["card", "bank_transfer"]);
    expect(resolveMethods(bankPartner, ["usdt", "lightning"])).toEqual([]);
  });
  it("ignores unknown methods", () => {
    expect(resolveMethods(["bank_transfer", "wire"], ["wire", "bank_transfer"])).toEqual(["bank_transfer"]);
  });
});

describe("parseChargeCode", () => {
  it("reads links, paths and bare codes", () => {
    expect(parseChargeCode("https://avec-pay.vercel.app/pagar/ABCD2345")).toBe("ABCD2345");
    expect(parseChargeCode("https://x.com/pagar/abcd2345?utm=1")).toBe("ABCD2345");
    expect(parseChargeCode("/pagar/ABCD2345")).toBe("ABCD2345");
    expect(parseChargeCode(" abcd2345 ")).toBe("ABCD2345");
  });
  it("rejects anything else", () => {
    expect(parseChargeCode("https://evil.example/pay/ABCD2345")).toBeNull();
    expect(parseChargeCode("hello")).toBeNull();
    expect(parseChargeCode("https://x.com/pagar/ABCD23456")).toBeNull();
  });
});

describe("generateChargeCode", () => {
  it("matches the database format", () => {
    for (let i = 0; i < 200; i++) expect(generateChargeCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});

describe("formatting and errors", () => {
  it("formats lempiras", () => {
    expect(formatMoney(250)).toBe("L 250.00");
    expect(formatMoney("1234.5")).toBe("L 1,234.50");
  });
  it("maps database error codes to Spanish", () => {
    expect(payErrorMessage('insufficient_funds')).toMatch(/Saldo insuficiente/);
    expect(payErrorMessage("something weird")).toMatch(/No se pudo/);
  });
});

describe("formatDateTime", () => {
  it("shows Honduras time regardless of the server's zone", () => {
    // 23:20 UTC is 17:20 in Tegucigalpa (UTC-6, no DST)
    expect(formatDateTime("2026-09-29T23:20:00Z", "es", "America/Tegucigalpa")).toMatch(/5:20/);
    expect(formatDateTime("2026-09-29T23:20:00Z", "en", "America/New_York")).toMatch(/7:20/);
  });
});
