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

export const METHOD_INFO: Record<Method, MethodInfo> = {
  bank_transfer: {
    label: "Transferencia bancaria",
    short: "Transferencia",
    kind: "fiat",
    description: "ACH Pronto, directo a la cuenta del comercio.",
  },
  tigo_money: {
    label: "Tigo Money",
    short: "Tigo Money",
    kind: "fiat",
    description: "Desde la billetera Tigo Money del cliente.",
  },
  card: {
    label: "Tarjeta o Apple Pay",
    short: "Tarjeta",
    kind: "fiat",
    description: "Débito, crédito o Apple Pay.",
  },
  lightning: {
    label: "Bitcoin Lightning",
    short: "Bitcoin ⚡",
    kind: "crypto",
    description: "Pago instantáneo en bitcoin.",
  },
  usdt: {
    label: "USDT",
    short: "USDT",
    kind: "crypto",
    description: "Dólar digital (stablecoin).",
  },
  zelle: {
    label: "Zelle",
    short: "Zelle",
    kind: "fiat",
    description: "Desde la app de tu banco en EE. UU.",
  },
};

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
