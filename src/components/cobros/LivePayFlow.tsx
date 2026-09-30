"use client";
import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/cobros/parse";
import { addMoney } from "@/lib/cobros/tip";
import { TipPicker } from "./TipPicker";
import { CopyButton } from "@/components/CopyButton";

interface Props {
  code: string;
  amount: number | string;
  currency: string;
  businessName: string;
  tipsAllowed: boolean;
  zelle: { handle: string; name: string } | null;
}

/**
 * Real money by Zelle. The customer needs no Avec account: they send the
 * total from their own bank app, then tap "Ya pagué". Avec never touches the
 * money; the merchant confirms once it shows up in their bank.
 */
export function LivePayFlow({ code, amount, currency, businessName, tipsAllowed, zelle }: Props) {
  const [tip, setTip] = useState<number | null>(0);
  const onTip = useCallback((t: number | null) => setTip(t), []);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<"pay" | "waiting" | "confirmed">("pay");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = addMoney(amount, tip ?? 0);
  const totalText = formatMoney(total, currency);
  const plain = total.toFixed(2);

  // After reporting, wait for the merchant's confirmation.
  useEffect(() => {
    if (stage !== "waiting") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/cobros/public/${code}`, { cache: "no-store" });
      if (res.ok && (await res.json()).status === "paid") setStage("confirmed");
    }, 3000);
    return () => clearInterval(t);
  }, [stage, code]);

  async function report() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cobros/live/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, tip: tip ?? 0, payerName: name }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "No se pudo reportar el pago");
    setStage("waiting");
  }

  if (!zelle) return <p className="card text-slate-700">Este comercio todavía no configuró cómo recibir pagos.</p>;

  if (stage === "confirmed") {
    return (
      <div className="card space-y-3 border-emerald-300 bg-emerald-50 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-4xl text-white">✓</div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Pago confirmado</p>
        <p className="text-3xl font-black">{totalText}</p>
        <p className="text-slate-700">{businessName} recibió tu pago. ¡Gracias!</p>
      </div>
    );
  }

  if (stage === "waiting") {
    return (
      <div className="card space-y-3 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand-ink" />
        <p className="font-semibold">Esperando que {businessName} confirme</p>
        <p className="text-sm text-slate-600">
          Le avisamos que enviaste {totalText} por Zelle. Esta pantalla cambia sola cuando lo confirme.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tipsAllowed && <TipPicker amount={amount} currency={currency} onChange={onTip} />}

      <div className="card space-y-3">
        <h2 className="font-semibold">1. Envía el pago por Zelle</h2>
        <p className="text-sm text-slate-600">Abre la app de tu banco (Chase, Bank of America, Wells Fargo…) → Zelle → Enviar, con estos datos:</p>
        <dl className="space-y-2">
          <Row label="Para" value={zelle.handle} copy={zelle.handle} />
          <Row label="Nombre" value={zelle.name} />
          <Row label="Monto" value={totalText} copy={plain} strong />
          <Row label="Nota / memo" value={code} copy={code} />
        </dl>
        <p className="text-xs text-slate-500">Revisa que el nombre en Zelle diga “{zelle.name}” antes de enviar.</p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">2. Avísale al comercio</h2>
        <input className="input" placeholder="Tu nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Tu nombre" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="button" className="btn-primary w-full py-4 text-base" disabled={busy || tip === null} onClick={report}>
          {busy ? "Enviando…" : `Ya pagué ${totalText}`}
        </button>
        <p className="text-xs text-slate-500">Toca este botón solo después de enviar el Zelle.</p>
      </div>
    </div>
  );
}

function Row({ label, value, copy, strong }: { label: string; value: string; copy?: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className={`break-words ${strong ? "text-xl font-black" : "font-semibold"}`}>{value}</dd>
      </div>
      {copy && <CopyButton value={copy} label="Copiar" />}
    </div>
  );
}
