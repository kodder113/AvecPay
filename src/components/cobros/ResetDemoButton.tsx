"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/LangProvider";

export function ResetDemoButton() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="rounded-xl border border-white/30 px-3 py-2 text-sm font-semibold text-white"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(t({ es: "¿Recargar tu cuenta de Banco Demo a L 10,000.00?", en: "Refill your Demo Bank account to L 10,000.00?" }))) return;
        setBusy(true);
        await fetch("/api/cobros/banco/reset", { method: "POST" });
        setBusy(false);
        router.refresh();
      }}
    >
      {busy ? t({ es: "Recargando…", en: "Refilling…" }) : t({ es: "Recargar L 10,000", en: "Refill L 10,000" })}
    </button>
  );
}
