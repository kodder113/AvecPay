import { describe, expect, it } from "vitest";
import { displayHandle, normalizeHandle, payLink } from "@/lib/cobros/handles";

describe("normalizeHandle", () => {
  it("cleans Zelle phones and emails", () => {
    expect(normalizeHandle("zelle", "(941) 685-6079")).toBe("941-685-6079");
    expect(normalizeHandle("zelle", "+1 941 685 6079")).toBe("941-685-6079");
    expect(normalizeHandle("zelle", "Oscar@Example.com")).toBe("oscar@example.com");
    expect(normalizeHandle("zelle", "12345")).toBeNull();
  });
  it("cleans Venmo, Cash App and PayPal handles", () => {
    expect(normalizeHandle("venmo", "@Oscar-Rod")).toBe("Oscar-Rod");
    expect(normalizeHandle("venmo", "https://venmo.com/u/Oscar-Rod")).toBe("Oscar-Rod");
    expect(normalizeHandle("venmo", "@ab")).toBeNull();
    expect(normalizeHandle("cashapp", "$AvecShop")).toBe("AvecShop");
    expect(normalizeHandle("cashapp", "$12345")).toBeNull();
    expect(normalizeHandle("paypal", "paypal.me/AvecShop")).toBeNull();
    expect(normalizeHandle("paypal", "https://paypal.me/AvecShop")).toBe("AvecShop");
    expect(normalizeHandle("paypal", "AvecShop")).toBe("AvecShop");
  });
});

describe("payLink", () => {
  it("fills in the amount", () => {
    expect(payLink("venmo", "Oscar-Rod", 12.5, "AB12CD34")).toBe("https://venmo.com/Oscar-Rod?txn=pay&amount=12.50&note=AB12CD34");
    expect(payLink("cashapp", "AvecShop", 12.5, "x")).toBe("https://cash.app/$AvecShop/12.50");
    expect(payLink("paypal", "AvecShop", 3, "x")).toBe("https://paypal.me/AvecShop/3.00USD");
    expect(payLink("zelle", "941-685-6079", 3, "x")).toBeNull();
    expect(displayHandle("cashapp", "AvecShop")).toBe("$AvecShop");
  });
});
