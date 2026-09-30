"use client";
import { useT } from "@/components/i18n/LangProvider";

/** Shown instead of silently treating a failed database read as "no data". */
export function DbError({ message }: { message: string }) {
  const t = useT();
  return (
    <div className="card space-y-2 border-red-200 bg-red-50">
      <p className="font-semibold text-red-800">{t({ es: "No se pudo leer tu comercio", en: "Couldn’t load your business" })}</p>
      <p className="break-words font-mono text-xs text-red-700">{message}</p>
      <p className="text-sm text-slate-600">
        {t({ es: "Si acabas de correr una migración en Supabase, ejecuta ", en: "If you just ran a migration in Supabase, run " })}
        <code>notify pgrst, &apos;reload schema&apos;;</code>
        {t({ es: " en el SQL Editor y recarga.", en: " in the SQL Editor and reload." })}
      </p>
    </div>
  );
}
