import { localeFor, type Lang } from "@/lib/i18n";

/**
 * Extracts a charge code from whatever a QR contains: a full payment link
 * (…/pagar/ABCD2345), a path, or the bare code. Returns null otherwise.
 */
export function parseChargeCode(text: string): string | null {
  const t = text.trim();
  const fromPath = /\/pagar\/([A-Za-z2-9]{8})(?:[/?#]|$)/.exec(t);
  if (fromPath) return fromPath[1].toUpperCase();
  if (/^[A-Za-z2-9]{8}$/.test(t)) return t.toUpperCase();
  return null;
}

export function formatMoney(amount: number | string, currency = "HNL"): string {
  const n = Number(amount);
  const symbol = currency === "HNL" ? "L" : currency === "USD" ? "$" : `${currency} `;
  return `${symbol} ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// One business time zone (US Eastern unless NEXT_PUBLIC_AVEC_TIMEZONE says otherwise);
// servers would render in UTC otherwise.
export const BUSINESS_TZ = process.env.NEXT_PUBLIC_AVEC_TIMEZONE ?? "America/New_York";

export function formatDateTime(iso: string, lang: Lang = "es", timeZone = BUSINESS_TZ): string {
  return new Date(iso).toLocaleString(localeFor(lang), { dateStyle: "medium", timeStyle: "short", timeZone });
}

const PAY_ERRORS: Record<string, { es: string; en: string }> = {
  not_authenticated: { es: "Inicia sesión para pagar.", en: "Sign in to pay." },
  charge_not_found: { es: "Este cobro no existe.", en: "This charge doesn't exist." },
  not_demo: { es: "Este cobro no es de prueba.", en: "This isn't a demo charge." },
  charge_not_pending: { es: "Este cobro ya fue pagado o cancelado.", en: "This charge was already paid or cancelled." },
  charge_expired: { es: "Este cobro venció. Pide un nuevo QR.", en: "This charge expired. Ask for a new QR." },
  method_not_allowed: { es: "Este comercio no acepta ese método de pago.", en: "This business doesn't accept that payment method." },
  cannot_pay_own_charge: {
    es: "No puedes pagar tu propio cobro. Pídele a otra persona que lo escanee.",
    en: "You can't pay your own charge. Ask someone else to scan it.",
  },
  insufficient_funds: {
    es: "Saldo insuficiente en Banco Demo. Recárgalo en la sección Banco Demo.",
    en: "Not enough Demo Bank balance. Refill it in Demo Bank.",
  },
  not_live: { es: "Este cobro es de prueba.", en: "This is a demo charge." },
  invalid_tip: { es: "La propina no es válida (máximo el 100% del monto).", en: "Invalid tip (at most 100% of the amount)." },
};

/** Maps a Banco Demo / charge error code to a message in the given language. */
export function payErrorMessage(raw: string, lang: Lang = "es"): string {
  const key = Object.keys(PAY_ERRORS).find((k) => raw.includes(k));
  return key ? PAY_ERRORS[key][lang] : lang === "es" ? "No se pudo completar el pago. Intenta de nuevo." : "The payment couldn't be completed. Try again.";
}
