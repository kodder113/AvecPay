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

// Honduras time everywhere; servers render in UTC otherwise.
export function formatDateTime(iso: string, timeZone = "America/Tegucigalpa"): string {
  return new Date(iso).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone });
}

/** Maps a Banco Demo / charge error code to a Spanish message. */
export function payErrorMessage(raw: string): string {
  const codes: Record<string, string> = {
    not_authenticated: "Inicia sesión para pagar.",
    charge_not_found: "Este cobro no existe.",
    not_demo: "Este cobro no es de prueba.",
    charge_not_pending: "Este cobro ya fue pagado o cancelado.",
    charge_expired: "Este cobro venció. Pide un nuevo QR.",
    method_not_allowed: "Este comercio no acepta ese método de pago.",
    cannot_pay_own_charge: "No puedes pagar tu propio cobro. Pídele a otra persona que lo escanee.",
    insufficient_funds: "Saldo insuficiente en Banco Demo. Recárgalo en la sección Banco Demo.",
  };
  const key = Object.keys(codes).find((k) => raw.includes(k));
  return key ? codes[key] : "No se pudo completar el pago. Intenta de nuevo.";
}
