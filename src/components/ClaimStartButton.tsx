"use client";
import { useState } from "react";
import { useT } from "@/components/i18n/LangProvider";

export function ClaimStartButton({ token, providerName }: { token: string; providerName: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/claim/${token}/start`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      setBusy(false);
      setError(body.error ?? t({ es: "No se pudo iniciar. Intenta de nuevo.", en: "Could not start. Please try again." }));
      return;
    }
    window.location.href = body.url;
  }

  return (
    <div className="space-y-2">
      <button className="btn-primary w-full" onClick={start} disabled={busy}>
        {busy ? t({ es: "Abriendo…", en: "Opening…" }) : t({ es: `Continuar con ${providerName}`, en: `Continue with ${providerName}` })}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
