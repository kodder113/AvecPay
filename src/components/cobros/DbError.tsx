/** Shown instead of silently treating a failed database read as "no data". */
export function DbError({ message }: { message: string }) {
  return (
    <div className="card space-y-2 border-red-200 bg-red-50">
      <p className="font-semibold text-red-800">No se pudo leer tu comercio</p>
      <p className="break-words font-mono text-xs text-red-700">{message}</p>
      <p className="text-sm text-slate-600">
        Si acabas de correr una migración en Supabase, ejecuta <code>notify pgrst, &apos;reload schema&apos;;</code> en el SQL Editor y recarga.
      </p>
    </div>
  );
}
