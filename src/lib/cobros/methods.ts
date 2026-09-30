import type { Lang, Tr } from "@/lib/i18n";

/**
 * Payment methods a merchant can accept. Each is switched on/off at two
 * levels: the partner (Avec direct, or a bank's white-label, e.g. fiat-only)
 * and the merchant. A charge offers the intersection, fixed at creation.
 */
export const METHODS = ["bank_transfer", "tigo_money", "card", "lightning", "usdt", "zelle"] as const;
export type Method = (typeof METHODS)[number];

export interface MethodInfo {
  label: string;
  short: string;
  kind: "fiat" | "crypto";
  description: string;
}

const METHOD_TEXT: Record<Method, { kind: MethodInfo["kind"]; label: Tr; short: Tr; description: Tr }> = {
  bank_transfer: {
    kind: "fiat",
    label: { es: "Transferencia bancaria", en: "Bank transfer" },
    short: { es: "Transferencia", en: "Transfer" },
    description: { es: "ACH Pronto, directo a la cuenta del comercio.", en: "ACH Pronto, straight to the business's account." },
  },
  tigo_money: {
    kind: "fiat",
    label: { es: "Tigo Money", en: "Tigo Money" },
    short: { es: "Tigo Money", en: "Tigo Money" },
    description: { es: "Desde la billetera Tigo Money del cliente.", en: "From the customer's Tigo Money wallet." },
  },
  card: {
    kind: "fiat",
    label: { es: "Tarjeta o Apple Pay", en: "Card or Apple Pay" },
    short: { es: "Tarjeta", en: "Card" },
    description: { es: "Débito, crédito o Apple Pay.", en: "Debit, credit or Apple Pay." },
  },
  lightning: {
    kind: "crypto",
    label: { es: "Bitcoin Lightning", en: "Bitcoin Lightning" },
    short: { es: "Bitcoin ⚡", en: "Bitcoin ⚡" },
    description: { es: "Pago instantáneo en bitcoin.", en: "Instant bitcoin payment." },
  },
  usdt: {
    kind: "crypto",
    label: { es: "USDT", en: "USDT" },
    short: { es: "USDT", en: "USDT" },
    description: { es: "Dólar digital (stablecoin).", en: "Digital dollar (stablecoin)." },
  },
  zelle: {
    kind: "fiat",
    label: { es: "Zelle", en: "Zelle" },
    short: { es: "Zelle", en: "Zelle" },
    description: { es: "Desde la app de tu banco en EE. UU.", en: "From your US bank's app." },
  },
};

/** Names and descriptions of every method, in one language. */
export function methodInfo(lang: Lang): Record<Method, MethodInfo> {
  return Object.fromEntries(
    METHODS.map((m) => {
      const x = METHOD_TEXT[m];
      return [m, { kind: x.kind, label: x.label[lang], short: x.short[lang], description: x.description[lang] }];
    }),
  ) as Record<Method, MethodInfo>;
}

/**
 * Methods that can take real money today; the rest are demo-only for now.
 * Card / Apple Pay needs Stripe set up for this merchant.
 */
export function liveMethods(stripe: boolean): readonly Method[] {
  return stripe ? ["zelle", "card"] : ["zelle"];
}

export function isMethod(v: unknown): v is Method {
  return typeof v === "string" && (METHODS as readonly string[]).includes(v);
}

/** Methods a charge may offer: partner switch ∩ merchant switch, in catalog order. */
export function resolveMethods(partnerAllowed: readonly string[], merchantEnabled: readonly string[]): Method[] {
  return METHODS.filter((m) => partnerAllowed.includes(m) && merchantEnabled.includes(m));
}
