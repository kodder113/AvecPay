/**
 * English / Spanish. Text lives next to where it's used as { es, en } pairs,
 * so every screen stays readable and a missing translation fails type-checking.
 */
export type Lang = "es" | "en";
export type Tr = { es: string; en: string };
export type T = (s: Tr) => string;

export const LANGS: readonly Lang[] = ["es", "en"];
/** Remembers the choice from the EN | ES switch, per device. */
export const LANG_COOKIE = "avec_lang";

export function isLang(v: unknown): v is Lang {
  return v === "es" || v === "en";
}

/** The saved choice, else the browser's language (Spanish only if it asks for it first). */
export function pickLang(saved: string | null | undefined, acceptLanguage: string | null | undefined): Lang {
  if (isLang(saved)) return saved;
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("es") ? "es" : "en";
}

export function translator(lang: Lang): T {
  return (s) => s[lang];
}

/** Number and date formatting locale for a language. */
export function localeFor(lang: Lang): string {
  return lang === "es" ? "es-HN" : "en-US";
}
