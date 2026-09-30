"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/LangProvider";

/**
 * Webhooks are the primary update path. This polls the provider as a backup
 * while the transfer is in flight, and re-renders the page.
 */
export function AutoRefresh({ transferId, active, intervalMs = 30_000 }: { transferId: string; active: boolean; intervalMs?: number }) {
  const router = useRouter();
  const tr = useT();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    try {
      const res = await fetch(`/api/transfers/${transferId}/refresh`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      setNote(res.ok ? (body.reason ?? null) : (body.error ?? tr({ es: "No se pudo actualizar", en: "Refresh failed" })));
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  useEffect(() => {
    if (!active) return;
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, transferId, intervalMs]);

  return (
    <div className="flex items-center gap-3">
      <button type="button" className="btn-secondary px-3 py-2" onClick={refresh} disabled={busy}>
        {busy ? tr({ es: "Revisando…", en: "Checking…" }) : tr({ es: "Revisar estado", en: "Check status" })}
      </button>
      {note && <span className="text-xs text-slate-500">{note}</span>}
    </div>
  );
}
