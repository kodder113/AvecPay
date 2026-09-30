"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { METHOD_INFO, type Method } from "@/lib/cobros/methods";

interface Props {
  initialName: string;
  allowed: Method[];
  enabled: Method[];
  tipsEnabled?: boolean;
  submitLabel: string;
  redirectTo: string;
}

/** Business name + payment-method switches (only methods the partner allows). */
export function MerchantSettings({ initialName, allowed, enabled, tipsEnabled = true, submitLabel, redirectTo }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [on, setOn] = useState<Set<Method>>(new Set(enabled));
  const [tips, setTips] = useState(tipsEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(m: Method) {
    const next = new Set(on);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    setOn(next);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!on.size) return setError("Activa al menos un método de pago.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cobros/merchant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName: name, methods: [...on], tipsEnabled: tips }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "No se pudo guardar");
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="card space-y-2">
        <label className="label" htmlFor="bn">Nombre del negocio</label>
        <input id="bn" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Baleadas Doña Rosa" required minLength={2} maxLength={80} />
      </div>
      <div className="card space-y-3">
        <div>
          <h2 className="font-semibold">Métodos de pago</h2>
          <p className="text-sm text-slate-500">Elige cómo pueden pagarte tus clientes. El dinero siempre va directo a tu cuenta o billetera.</p>
        </div>
        {allowed.map((m) => (
          <label key={m} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <span>
              <span className="block font-medium">{METHOD_INFO[m].label}</span>
              <span className="block text-xs text-slate-500">{METHOD_INFO[m].description}</span>
            </span>
            <input type="checkbox" className="h-6 w-6 accent-brand-ink" checked={on.has(m)} onChange={() => toggle(m)} />
          </label>
        ))}
      </div>
      <label className="card flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="block font-semibold">Aceptar propinas</span>
          <span className="block text-sm text-slate-500">El cliente puede agregar 10%, 15%, 20% o el monto que quiera.</span>
        </span>
        <input type="checkbox" className="h-6 w-6 accent-brand-ink" checked={tips} onChange={() => setTips(!tips)} />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
