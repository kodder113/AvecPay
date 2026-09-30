"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { METHOD_ICON, methodInfo, type Method } from "@/lib/cobros/methods";
import { isHandleMethod, type HandleMethod } from "@/lib/cobros/handles";
import { useLang, useT } from "@/components/i18n/LangProvider";

export interface MerchantSettingsValues {
  name: string;
  enabled: Method[];
  tipsEnabled: boolean;
  mode: "demo" | "live";
  currency: "HNL" | "USD";
  handles: Partial<Record<HandleMethod, string>>;
  zelleName: string;
}

/** Where the merchant's card payments stand. */
export type CardStatus = "ready" | "pending" | "not_connected" | "legacy" | "unavailable";

interface Props {
  initial: MerchantSettingsValues;
  allowed: Method[];
  /** Methods that move real money for this merchant (card only once Stripe is connected). */
  liveMethods: readonly Method[];
  /** Card payments (Ajustes only; hidden while creating the business). */
  card?: CardStatus;
  submitLabel: string;
  redirectTo: string;
}

const HANDLE_PLACEHOLDER: Record<HandleMethod, { es: string; en: string }> = {
  zelle: { es: "Teléfono o correo de tu Zelle", en: "Your Zelle phone or email" },
  venmo: { es: "Tu usuario de Venmo (@usuario)", en: "Your Venmo username (@username)" },
  cashapp: { es: "Tu $cashtag", en: "Your $cashtag" },
  paypal: { es: "Tu usuario de paypal.me", en: "Your paypal.me username" },
};

/** Business profile, demo/live mode, currency, payment methods and handles, tips. */
export function MerchantSettings({ initial, allowed, liveMethods, card, submitLabel, redirectTo }: Props) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const info = methodInfo(lang);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof MerchantSettingsValues>(k: K, val: MerchantSettingsValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const setHandle = (m: HandleMethod, h: string) => setV((s) => ({ ...s, handles: { ...s.handles, [m]: h } }));

  function toggle(m: Method) {
    set("enabled", v.enabled.includes(m) ? v.enabled.filter((x) => x !== m) : [...v.enabled, m]);
  }

  const liveText = liveMethods.map((m) => info[m].label).join(", ");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v.enabled.length) return setError(t({ es: "Activa al menos un método de pago.", en: "Turn on at least one payment method." }));
    if (v.mode === "live" && !v.enabled.some((m) => liveMethods.includes(m))) {
      return setError(t({ es: `En modo real activa al menos uno: ${liveText}.`, en: `In live mode, turn on at least one of: ${liveText}.` }));
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
        handles: v.handles,
        zelleName: v.zelleName,
      }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? t({ es: "No se pudo guardar", en: "Couldn’t save" }));
    router.push(redirectTo);
    router.refresh();
  }

  async function connectStripe() {
    setConnecting(true);
    setError(null);
    const res = await fetch("/api/connect/onboard", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setConnecting(false);
      return setError(data.error ?? t({ es: "No se pudo abrir Stripe", en: "Couldn’t open Stripe" }));
    }
    window.location.assign(data.url);
  }

  const segment = (active: boolean) => `flex-1 rounded-xl border-2 px-3 py-3 text-sm font-semibold ${active ? "border-brand-ink bg-brand-yellow" : "border-slate-200"}`;

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="card space-y-2">
        <label className="label" htmlFor="bn">{t({ es: "Nombre del negocio", en: "Business name" })}</label>
        <input id="bn" className="input" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder={t({ es: "Baleadas Doña Rosa", en: "Rosa's Appliance Repair" })} required minLength={2} maxLength={80} />
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">{t({ es: "Modo", en: "Mode" })}</h2>
        <div className="flex gap-2">
          <button type="button" className={segment(v.mode === "demo")} onClick={() => set("mode", "demo")}>
            Demo <span className="block text-xs font-normal">{t({ es: "Dinero de prueba para practicar", en: "Play money to practice" })}</span>
          </button>
          <button type="button" className={segment(v.mode === "live")} onClick={() => set("mode", "live")}>
            {t({ es: "Real", en: "Live" })} <span className="block text-xs font-normal">{t({ es: "Dinero real a tu cuenta", en: "Real money to your account" })}</span>
          </button>
        </div>
        {/* Lempiras only for businesses that already use them; new ones are in dollars. */}
        {initial.currency === "HNL" && (
          <>
            <h2 className="pt-2 font-semibold">{t({ es: "Moneda", en: "Currency" })}</h2>
            <div className="flex gap-2">
              <button type="button" className={segment(v.currency === "HNL")} onClick={() => set("currency", "HNL")}>
                L · Lempiras
              </button>
              <button type="button" className={segment(v.currency === "USD")} onClick={() => set("currency", "USD")}>
                {t({ es: "$ · Dólares", en: "$ · Dollars" })}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card space-y-3">
        <div>
          <h2 className="font-semibold">{t({ es: "Cómo te pagan tus clientes", en: "How customers pay you" })}</h2>
          <p className="text-sm text-slate-500">{t({ es: "El dinero va directo a tu cuenta. Avec nunca lo toca.", en: "Money goes straight to your account. Avec never touches it." })}</p>
        </div>
        {allowed.map((m) => {
          const liveOk = liveMethods.includes(m);
          const on = v.enabled.includes(m);
          return (
            <div key={m} className="rounded-xl border border-slate-200 p-3">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-start gap-2">
                  <span className="text-xl leading-6">{METHOD_ICON[m]}</span>
                  <span>
                    <span className="block font-medium">
                      {info[m].label}
                      {v.mode === "live" && !liveOk && m !== "card" && <span className="ml-2 text-xs font-normal text-slate-400">{t({ es: "solo demo", en: "demo only" })}</span>}
                    </span>
                    <span className="block text-xs text-slate-500">{info[m].description}</span>
                  </span>
                </span>
                <input type="checkbox" className="h-6 w-6 shrink-0 accent-brand-ink" checked={on} onChange={() => toggle(m)} />
              </label>

              {m === "card" && v.mode === "live" && card && <CardConnect status={card} busy={connecting} onConnect={connectStripe} />}

              {isHandleMethod(m) && on && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <input
                    className="input"
                    inputMode={m === "zelle" ? "email" : "text"}
                    autoCapitalize="none"
                    placeholder={t(HANDLE_PLACEHOLDER[m])}
                    value={v.handles[m] ?? ""}
                    onChange={(e) => setHandle(m, e.target.value)}
                    aria-label={t(HANDLE_PLACEHOLDER[m])}
                  />
                  {m === "zelle" && (
                    <input
                      className="input"
                      placeholder={t({ es: "Nombre que verá el cliente en Zelle", en: "Name customers will see in Zelle" })}
                      value={v.zelleName}
                      onChange={(e) => set("zelleName", e.target.value)}
                      aria-label={t({ es: "Nombre en Zelle", en: "Name in Zelle" })}
                      maxLength={60}
                    />
                  )}
                  <p className="text-xs text-slate-500">
                    {t({ es: "El cliente paga desde su app y tú confirmas “Recibido”. Sin comisión de Avec.", en: "The customer pays from their app and you tap “Received”. No Avec fee." })}
                  </p>
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

function CardConnect({ status, busy, onConnect }: { status: CardStatus; busy: boolean; onConnect: () => void }) {
  const t = useT();
  if (status === "ready" || status === "legacy") {
    return (
      <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
        ✓ {t({ es: "Stripe conectado. Los pagos con tarjeta llegan a tu banco.", en: "Stripe connected. Card payments go to your bank." })}
      </p>
    );
  }
  if (status === "unavailable") {
    return <p className="mt-3 text-xs text-slate-500">{t({ es: "Los pagos con tarjeta aún no están disponibles.", en: "Card payments aren’t available yet." })}</p>;
  }
  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <p className="text-sm text-slate-600">
        {status === "pending"
          ? t({ es: "Stripe necesita que termines tu registro para activar los pagos.", en: "Stripe needs you to finish signing up before payments turn on." })
          : t({
              es: "Conecta tu cuenta de Stripe (o crea una en minutos) para cobrar con tarjeta, Apple Pay y Google Pay. El dinero llega a tu banco.",
              en: "Connect your Stripe account (or create one in minutes) to take card, Apple Pay and Google Pay. Money goes to your bank.",
            })}
      </p>
      <button type="button" className="btn-secondary w-full" disabled={busy} onClick={onConnect}>
        {busy ? t({ es: "Abriendo Stripe…", en: "Opening Stripe…" }) : status === "pending" ? t({ es: "Terminar registro en Stripe", en: "Finish Stripe sign-up" }) : t({ es: "Conectar Stripe", en: "Connect Stripe" })}
      </button>
    </div>
  );
}
