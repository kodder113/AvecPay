/**
 * Payment apps where the customer pays the merchant's own handle: Zelle,
 * Venmo, Cash App, PayPal. Avec never touches the money; the customer taps
 * "I paid" and the merchant confirms.
 */
export const HANDLE_METHODS = ["zelle", "venmo", "cashapp", "paypal"] as const;
export type HandleMethod = (typeof HANDLE_METHODS)[number];

export function isHandleMethod(m: string): m is HandleMethod {
  return (HANDLE_METHODS as readonly string[]).includes(m);
}

/** Cleans what the merchant typed into the canonical handle, or null if invalid. */
export function normalizeHandle(method: HandleMethod, raw: string): string | null {
  const v = raw.trim();
  switch (method) {
    case "zelle": {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v.toLowerCase();
      const digits = v.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
      return /^\d{10}$/.test(digits) ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : null;
    }
    case "venmo": {
      const u = v.replace(/^https?:\/\/(www\.)?venmo\.com\/(u\/)?/i, "").replace(/^@/, "");
      return /^[A-Za-z0-9_-]{5,30}$/.test(u) ? u : null;
    }
    case "cashapp": {
      const u = v.replace(/^https?:\/\/(www\.)?cash\.app\//i, "").replace(/^\$/, "");
      return /^(?=.*[A-Za-z])[A-Za-z0-9]{1,20}$/.test(u) ? u : null;
    }
    case "paypal": {
      const u = v.replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/^@/, "");
      return /^[A-Za-z0-9]{1,20}$/.test(u) ? u : null;
    }
  }
}

/** How the handle is shown to customers. */
export function displayHandle(method: HandleMethod, handle: string): string {
  if (method === "venmo") return `@${handle}`;
  if (method === "cashapp") return `$${handle}`;
  if (method === "paypal") return `paypal.me/${handle}`;
  return handle;
}

/**
 * Opens the payment app with the amount (and a note where supported) filled
 * in. Zelle has no such link; the customer uses their bank's app.
 */
export function payLink(method: HandleMethod, handle: string, amount: number, note: string): string | null {
  const amt = amount.toFixed(2);
  switch (method) {
    case "venmo":
      return `https://venmo.com/${encodeURIComponent(handle)}?txn=pay&amount=${amt}&note=${encodeURIComponent(note)}`;
    case "cashapp":
      return `https://cash.app/$${encodeURIComponent(handle)}/${amt}`;
    case "paypal":
      return `https://paypal.me/${encodeURIComponent(handle)}/${amt}USD`;
    default:
      return null;
  }
}
