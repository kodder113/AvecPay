import { describe, expect, it } from "vitest";
import { pickLang, translator } from "@/lib/i18n";
import { methodInfo } from "@/lib/cobros/methods";
import { payErrorMessage } from "@/lib/cobros/parse";

describe("pickLang", () => {
  it("uses the saved choice first", () => {
    expect(pickLang("en", "es-HN,es;q=0.9")).toBe("en");
    expect(pickLang("es", "en-US")).toBe("es");
  });
  it("falls back to the browser's first language, English unless it's Spanish", () => {
    expect(pickLang(undefined, "es-HN,es;q=0.9,en;q=0.8")).toBe("es");
    expect(pickLang(null, "en-US,es;q=0.5")).toBe("en");
    expect(pickLang("fr", "")).toBe("en");
  });
});

describe("translations", () => {
  it("translator picks the language", () => {
    expect(translator("en")({ es: "Cobrar", en: "Charge" })).toBe("Charge");
  });
  it("method names and pay errors exist in both languages", () => {
    expect(methodInfo("en").card.label).toBe("Card, Apple Pay or Google Pay");
    expect(methodInfo("es").card.label).toBe("Tarjeta, Apple Pay o Google Pay");
    expect(payErrorMessage("ERROR: charge_expired", "en")).toMatch(/expired/);
    expect(payErrorMessage("ERROR: charge_expired", "es")).toMatch(/venció/);
  });
});
