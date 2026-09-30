"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { METHOD_INFO, type Method } from "@/lib/cobros/methods";

export interface MerchantSettingsValues {
  name: string;
  enabled: Method[];
  tipsEnabled: boolean;
  mode: "demo" | "live";
  currency: "HNL" | "USD";
  zelleHandle: string;
  zelleName: string;
}

interface Props {
  initial: MerchantSettingsValues;
  allowed: Method[];
  /** Methods that move real money for this merchant (card only with Stripe). */
  liveMethods: readonly Method[];
  /** Why card isn't live (Ajustes only), to point at the missing setting. */
  cardStatus?: string;
  submitLabel: string;
  redirectTo: string;
}

const CARD_HINT: Record<string, string> = {
  missing_key: "Para activar tarjeta en modo real falta STRIPE_SECRET_KEY en Vercel (Production).",
  missing_webhook_secret: "Para activar tarjeta en modo real falta STRIPE_WEBHOOK_SECRET en Vercel (Production).",
  missing_owner: "Para activar tarjeta en modo real falta AVEC_STRIPE_OWNER_EMAIL en Vercel (Production).",
  not_owner: "Tarjeta en modo real está activada para otro correo (AVEC_STRIPE_OWNER_EMAIL no coincide con tu cuenta).",
};

/** Business profile, demo/real mode, currency, payment-method switches and tips. */
export function MerchantSettings({ initial, allowed, liveMethods, cardStatus, submitLabel, redirectTo }: Props) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof MerchantSettingsValues>(k: K, val: MerchantSettingsValues[K]) => setV((s) => ({ ...s, [k]: val }));

  function toggle(m: Method) {
    set("enabled", v.enabled.includes(m) ? v.enabled.filter((x) => x !== m) : [...v.enabled, m]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v.enabled.length) return setError("Activa al menos un método de pago.");
    if (v.mode === "live" && !v.enabled.some((m) => liveMethods.includes(m))) {
      return setError(`En modo real activa ${liveText}.`);
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cobros/merchant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: v.name,
        methods: v.enabled,
        tipsEnabled: v.tipsEnabled,
        mode: v.mode,
        currency: v.currency,
        zelleHandle: v.zelleHandle,
        zelleName: v.zelleName,
      }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "No se pudo guardar");
    router.push(redirectTo);
    router.refresh();
  }

  const liveText = liveMethods.map((m) => METHOD_INFO[m].label).join(" o ");
  const segment = (active: boolean) => `flex-1 rounded-xl border-2 px-3 py-3 text-sm font-semibold ${active ? "border-brand-ink bg-brand-yellow" : "border-slate-200"}`;

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="card space-y-2">
        <label className="label" htmlFor="bn">Nombre del negocio</label>
        <input id="bn" className="input" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Baleadas Doña Rosa" required minLength={2} maxLength={80} />
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Modo</h2>
        <div className="flex gap-2">
          <button type="button" className={segment(v.mode === "demo")} onClick={() => set("mode", "demo")}>
            Demo <span className="block text-xs font-normal">Banco Demo, dinero de prueba</span>
          </button>
          <button type="button" className={segment(v.mode === "live")} onClick={() => set("mode", "live")}>
            Real <span className="block text-xs font-normal">Dinero real a tu cuenta</span>
          </button>
        </div>
        <h2 className="pt-2 font-semibold">Moneda</h2>
        <div className="flex gap-2">
          <button type="button" className={segment(v.currency === "HNL")} onClick={() => set("currency", "HNL")}>L · Lempiras</button>
          <button type="button" className={segment(v.currency === "USD")} onClick={() => set("currency", "USD")}>$ · Dólares</button>
        </div>
      </div>

      <div className="card space-y-3">
        <div>
          <h2 className="font-semibold">Métodos de pago</h2>
          <p className="text-sm text-slate-500">
            El dinero siempre va directo a tu cuenta o billetera.{" "}
            {v.mode === "live" && `En modo real, por ahora solo ${liveText} mueve dinero real.`}
          </p>
        </div>
        {allowed.map((m) => {
          const liveOk = liveMethods.includes(m);
          return (
            <div key={m} className="rounded-xl border border-slate-200 p-3">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="block font-medium">
                    {METHOD_INFO[m].label}
                    {v.mode === "live" && !liveOk && <span className="ml-2 text-xs font-normal text-slate-400">solo demo</span>}
                    {v.mode === "live" && liveOk && m === "card" && v.currency !== "USD" && (
                      <span className="ml-2 text-xs font-normal text-slate-400">solo en dólares</span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">{METHOD_INFO[m].description}</span>
                </span>
                <input type="checkbox" className="h-6 w-6 accent-brand-ink" checked={v.enabled.includes(m)} onChange={() => toggle(m)} />
              </label>
              {m === "card" && v.mode === "live" && cardStatus && cardStatus !== "ok" && (
                <p className="mt-2 text-xs text-amber-700">{CARD_HINT[cardStatus] ?? cardStatus}</p>
              )}
              {m === "zelle" && v.enabled.includes("zelle") && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <input className="input" inputMode="email" placeholder="Teléfono o correo de tu Zelle" value={v.zelleHandle} onChange={(e) => set("zelleHandle", e.target.value)} aria-label="Zelle" />
                  <input className="input" placeholder="Nombre que verá el cliente en Zelle" value={v.zelleName} onChange={(e) => set("zelleName", e.target.value)} aria-label="Nombre en Zelle" maxLength={60} />
                  <p className="text-xs text-slate-500">Los clientes verán estos datos para enviarte el pago desde su banco.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <label className="card flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="block font-semibold">Aceptar propinas</span>
          <span className="block text-sm text-slate-500">El cliente puede agregar 10%, 15%, 20% o el monto que quiera.</span>
        </span>
        <input type="checkbox" className="h-6 w-6 accent-brand-ink" checked={v.tipsEnabled} onChange={() => set("tipsEnabled", !v.tipsEnabled)} />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
