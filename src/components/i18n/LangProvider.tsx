"use client";
import { createContext, useContext, useMemo } from "react";
import { translator, type Lang, type T } from "@/lib/i18n";

const LangContext = createContext<Lang>("es");

/** Set once in the root layout from the request's language. */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

/** t({ es: "…", en: "…" }) in client components. */
export function useT(): T {
  const lang = useLang();
  return useMemo(() => translator(lang), [lang]);
}
