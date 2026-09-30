"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { methodInfo, type Method } from "@/lib/cobros/methods";
import type { Tr } from "@/lib/i18n";
import { useLang, useT } from "@/components/i18n/LangProvider";

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

const CARD_HINT: Record<string, Tr> = {
  missing_key: {
    es: "Para activar tarjeta en modo real falta STRIPE_SECRET_KEY en Vercel (Production).",
    en: "To turn on card in live mode, add STRIPE_SECRET_KEY in Vercel (Production).",
  },
  missing_webhook_secret: {
    es: "Para activar tarjeta en modo real falta STRIPE_WEBHOOK_SECRET en Vercel (Production).",
    en: "To turn on card in live mode, add STRIPE_WEBHOOK_SECRET in Vercel (Production).",
  },
  missing_owner: {
    es: "Para activar tarjeta en modo real falta AVEC_STRIPE_OWNER_EMAIL en Vercel (Production).",
    en: "To turn on card in live mode, add AVEC_STRIPE_OWNER_EMAIL in Vercel (Production).",
  },
  not_owner: {
    es: "Tarjeta en modo real está activada para otro correo (AVEC_STRIPE_OWNER_EMAIL no coincide con tu cuenta).",
    en: "Live card payments are on for a different email (AVEC_STRIPE_OWNER_EMAIL doesn’t match your account).",
  },
};

/** Business profile, demo/real mode, currency, payment-method switches and tips. */
export function MerchantSettings({ initial, allowed, liveMethods, cardStatus, submitLabel, redirectTo }: Props) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const info = methodInfo(lang);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof MerchantSettingsValues>(k: K, val: MerchantSettingsValues[K]) => setV((s) => ({ ...s, [k]: val }));

  function toggle(m: Method) {
    set("enabled", v.enabled.includes(m) ? v.enabled.filter((x) => x !== m) : [...v.enabled, m]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v.enabled.length) return setError(t({ es: "Activa al menos un método de pago.", en: "Turn on at least one payment method." }));
    if (v.mode === "live" && !v.enabled.some((m) => liveMethods.includes(m))) {
      return setError(t({ es: `En modo real activa ${liveText}.`, en: `In live mode, turn on ${liveText}.` }));
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
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? t({ es: "No se pudo guardar", en: "Couldn’t save" }));
    router.push(redirectTo);
    router.refresh();
  }

  const liveText = liveMethods.map((m) => info[m].label).join(t({ es: " o ", en: " or " }));
  const segment = (active: boolean) => `flex-1 rounded-xl border-2 px-3 py-3 text-sm font-semibold ${active ? "border-brand-ink bg-brand-yellow" : "border-slate-200"}`;

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="card space-y-2">
        <label className="label" htmlFor="bn">{t({ es: "Nombre del negocio", en: "Business name" })}</label>
        <input id="bn" className="input" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Baleadas Doña Rosa" required minLength={2} maxLength={80} />
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">{t({ es: "Modo", en: "Mode" })}</h2>
        <div className="flex gap-2">
          <button type="button" className={segment(v.mode === "demo")} onClick={() => set("mode", "demo")}>
            Demo <span className="block text-xs font-normal">{t({ es: "Banco Demo, dinero de prueba", en: "Demo Bank, test money" })}</span>
          </button>
          <button type="button" className={segment(v.mode === "live")} onClick={() => set("mode", "live")}>
            {t({ es: "Real", en: "Live" })} <span className="block text-xs font-normal">{t({ es: "Dinero real a tu cuenta", en: "Real money to your account" })}</span>
          </button>
        </div>
        <h2 className="pt-2 font-semibold">{t({ es: "Moneda", en: "Currency" })}</h2>
        <div className="flex gap-2">
          <button type="button" className={segment(v.currency === "HNL")} onClick={() => set("currency", "HNL")}>{t({ es: "L · Lempiras", en: "L · Lempiras" })}</button>
          <button type="button" className={segment(v.currency === "USD")} onClick={() => set("currency", "USD")}>{t({ es: "$ · Dólares", en: "$ · Dollars" })}</button>
        </div>
      </div>

      <div className="card space-y-3">
        <div>
          <h2 className="font-semibold">{t({ es: "Métodos de pago", en: "Payment methods" })}</h2>
          <p className="text-sm text-slate-500">
            {t({ es: "El dinero siempre va directo a tu cuenta o billetera.", en: "Money always goes straight to your account or wallet." })}{" "}
            {v.mode === "live" &&
              t({ es: `En modo real, por ahora solo ${liveText} mueve dinero real.`, en: `In live mode, only ${liveText} moves real money for now.` })}
          </p>
        </div>
        {allowed.map((m) => {
          const liveOk = liveMethods.includes(m);
          return (
            <div key={m} className="rounded-xl border border-slate-200 p-3">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="block font-medium">
                    {info[m].label}
                    {v.mode === "live" && !liveOk && <span className="ml-2 text-xs font-normal text-slate-400">{t({ es: "solo demo", en: "demo only" })}</span>}
                    {v.mode === "live" && liveOk && m === "card" && v.currency !== "USD" && (
                      <span className="ml-2 text-xs font-normal text-slate-400">{t({ es: "solo en dólares", en: "dollars only" })}</span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">{info[m].description}</span>
                </span>
                <input type="checkbox" className="h-6 w-6 accent-brand-ink" checked={v.enabled.includes(m)} onChange={() => toggle(m)} />
              </label>
              {m === "card" && v.mode === "live" && cardStatus && cardStatus !== "ok" && (
                <p className="mt-2 text-xs text-amber-700">{CARD_HINT[cardStatus] ? t(CARD_HINT[cardStatus]) : cardStatus}</p>
              )}
              {m === "zelle" && v.enabled.includes("zelle") && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <input className="input" inputMode="email" placeholder={t({ es: "Teléfono o correo de tu Zelle", en: "Your Zelle phone or email" })} value={v.zelleHandle} onChange={(e) => set("zelleHandle", e.target.value)} aria-label="Zelle" />
                  <input className="input" placeholder={t({ es: "Nombre que verá el cliente en Zelle", en: "Name customers will see in Zelle" })} value={v.zelleName} onChange={(e) => set("zelleName", e.target.value)} aria-label={t({ es: "Nombre en Zelle", en: "Zelle name" })} maxLength={60} />
                  <p className="text-xs text-slate-500">{t({ es: "Los clientes verán estos datos para enviarte el pago desde su banco.", en: "Customers will see these details to send you the payment from their bank." })}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <label className="card flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="block font-semibold">{t({ es: "Aceptar propinas", en: "Accept tips" })}</span>
          <span className="block text-sm text-slate-500">{t({ es: "El cliente puede agregar 10%, 15%, 20% o el monto que quiera.", en: "Customers can add 10%, 15%, 20%, or any amount they want." })}</span>
        </span>
        <input type="checkbox" className="h-6 w-6 accent-brand-ink" checked={v.tipsEnabled} onChange={() => set("tipsEnabled", !v.tipsEnabled)} />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? t({ es: "Guardando…", en: "Saving…" }) : submitLabel}
      </button>
    </form>
  );
}
