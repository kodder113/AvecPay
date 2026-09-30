export function fmtAmount(value: number | string | null | undefined, currency?: string | null, maxDp = 2): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  // Fiat (2dp) always shows cents; crypto and rates trim trailing zeros.
  const num = n.toLocaleString("en-US", { minimumFractionDigits: maxDp === 2 ? 2 : 0, maximumFractionDigits: maxDp });
  return currency ? `${num} ${currency.toUpperCase()}` : num;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function networkLabel(network: string | null | undefined): string {
  if (!network) return "";
  return network.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function countryName(code: string, lang: "es" | "en" = "en"): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
