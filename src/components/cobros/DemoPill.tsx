"use client";
import { useT } from "@/components/i18n/LangProvider";

export function DemoPill() {
  return <ModePill mode="demo" />;
}

/** Shows whether a screen moves play money (Banco Demo) or real money. */
export function ModePill({ mode }: { mode: string }) {
  const t = useT();
  return mode === "live" ? (
    <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-900">
      {t({ es: "Dinero real", en: "Real money" })}
    </span>
  ) : (
    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900">
      {t({ es: "Demo · dinero de prueba", en: "Demo · play money" })}
    </span>
  );
}
