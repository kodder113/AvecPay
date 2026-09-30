"use client";
import { useState } from "react";
import Link from "next/link";
import { methodInfo, type Method } from "@/lib/cobros/methods";
import { formatMoney } from "@/lib/cobros/parse";
import { addMoney } from "@/lib/cobros/tip";
import { TipPicker } from "./TipPicker";
import { useLang, useT } from "@/components/i18n/LangProvider";

interface Props {
  code: string;
  amount: number | string;
  currency: string;
  businessName: string;
  methods: Method[];
  demoAccount: { account_number: string; balance: number | string } | null;
  tipsAllowed: boolean;
}

const ICON: Record<Method, string> = { bank_transfer: "🏦", tigo_money: "📱", card: "💳", lightning: "⚡", usdt: "💵", zelle: "🇺🇸" };

/** Customer flow: pick a method, see its (simulated) screen, pay from Banco Demo. */
export function PayFlow({ code, amount, currency, businessName, methods, demoAccount, tipsAllowed }: Props) {
  const t = useT();
  const info = methodInfo(useLang());
  const [method, setMethod] = useState<Method | null>(methods.length === 1 ? methods[0] : null);
  const [stage, setStage] = useState<"choose" | "processing" | "done">("choose");
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [tip, setTip] = useState<number | null>(0);
  const total = addMoney(amount, tip ?? 0);
  const money = formatMoney(total, currency);

  async function pay() {
    if (!method) return;
    setError(null);
    setStage("processing");
    // A short pause so the simulated bank feels like one.
    const [res] = await Promise.all([
      fetch("/api/cobros/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, method, tip: tip ?? 0 }),
      }),
      new Promise((r) => setTimeout(r, 1800)),
    ]);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStage("choose");
      return setError(body.error ?? t({ es: "No se pudo completar el pago", en: "The payment couldn't be completed" }));
    }
    setReference(body.reference);
    setStage("done");
  }

  if (stage === "done") {
    return (
      <div className="card space-y-3 border-emerald-300 bg-emerald-50 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-4xl text-white">✓</div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">{t({ es: "Pago enviado", en: "Payment sent" })}</p>
        <p className="text-3xl font-black">{money}</p>
        {tip ? <p className="text-sm text-slate-600">{t({ es: `incluye propina de ${formatMoney(tip, currency)} · ¡gracias!`, en: `includes a ${formatMoney(tip, currency)} tip · thank you!` })}</p> : null}
        <p className="text-slate-700">{t({ es: "a", en: "to" })} <b>{businessName}</b></p>
        <p className="text-sm text-slate-600">{t({ es: "Referencia", en: "Reference" })} <span className="font-mono font-semibold">{reference}</span></p>
        <Link href="/banco-demo" className="btn-secondary w-full">{t({ es: "Ver mi Banco Demo", en: "See my Demo Bank" })}</Link>
      </div>
    );
  }

  if (stage === "processing") {
    return (
      <div className="card space-y-3 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand-ink" />
        <p className="font-semibold">{t({ es: "Procesando con Banco Demo…", en: "Processing with Demo Bank…" })}</p>
        <p className="text-sm text-slate-500">{method && info[method].label} · {money}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="font-semibold">{t({ es: "¿Cómo quieres pagar?", en: "How do you want to pay?" })}</h2>
        <div className="grid gap-2">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left ${method === m ? "border-brand-ink bg-slate-50" : "border-slate-200"}`}
            >
              <span className="text-2xl">{ICON[m]}</span>
              <span>
                <span className="block font-medium">{info[m].label}</span>
                <span className="block text-xs text-slate-500">{info[m].description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {tipsAllowed && <TipPicker amount={amount} currency={currency} onChange={setTip} />}

      {method && <MethodScreen method={method} money={money} businessName={businessName} code={code} account={demoAccount?.account_number ?? null} />}

      {error && <p className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</p>}

      {demoAccount ? (
        <div className="space-y-2">
          <button type="button" className="btn-primary w-full py-4 text-base" disabled={!method || tip === null} onClick={pay}>
            {t({ es: `Pagar ${money}`, en: `Pay ${money}` })}
          </button>
          <p className="text-center text-xs text-slate-500">
            {t({
              es: `Se descuenta de tu Banco Demo (${demoAccount.account_number}) · saldo ${formatMoney(demoAccount.balance)}`,
              en: `Taken from your Demo Bank (${demoAccount.account_number}) · balance ${formatMoney(demoAccount.balance)}`,
            })}
          </p>
        </div>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(`/pagar/${code}`)}`} className="btn-primary w-full py-4 text-base">
          {t({ es: "Inicia sesión para pagar", en: "Sign in to pay" })}
        </Link>
      )}
    </div>
  );
}

/** What each method looks like. In demo, every one is simulated by Banco Demo. */
function MethodScreen({ method, money, businessName, code, account }: { method: Method; money: string; businessName: string; code: string; account: string | null }) {
  const t = useT();
  const box = "card space-y-1 text-sm text-slate-700";
  switch (method) {
    case "bank_transfer":
      return (
        <div className={box}>
          <p className="font-semibold">{t({ es: "Transferencia ACH Pronto (simulada)", en: "ACH Pronto transfer (simulated)" })}</p>
          <p>{t({ es: "Desde: Banco Demo", en: "From: Demo Bank" })} {account ?? ""}</p>
          <p>{t({ es: "Para:", en: "To:" })} {businessName}</p>
          <p>{t({ es: "Referencia del cobro:", en: "Charge reference:" })} <span className="font-mono">{code}</span></p>
        </div>
      );
    case "tigo_money":
      return (
        <div className={box}>
          <p className="font-semibold">{t({ es: "Tigo Money (simulado)", en: "Tigo Money (simulated)" })}</p>
          <p>{t({ es: `Pagarás ${money} a ${businessName} desde tu billetera Tigo Money de prueba.`, en: `You'll pay ${money} to ${businessName} from your test Tigo Money wallet.` })}</p>
        </div>
      );
    case "card":
      return (
        <div className={box}>
          <p className="font-semibold">{t({ es: "Tarjeta o Apple Pay (simulado)", en: "Card or Apple Pay (simulated)" })}</p>
          <p className="font-mono">•••• •••• •••• 4242 · 12/29</p>
          <p className="text-xs text-slate-500">{t({ es: "En modo demo no se usa ninguna tarjeta real.", en: "No real card is used in demo mode." })}</p>
        </div>
      );
    case "lightning":
      return (
        <div className={box}>
          <p className="font-semibold">{t({ es: "Bitcoin Lightning (simulado)", en: "Bitcoin Lightning (simulated)" })}</p>
          <p className="break-all font-mono text-xs text-slate-500">lnbc{code.toLowerCase()}demo1p…</p>
          <p>{t({ es: `Factura por ${money}, pagada al instante.`, en: `Invoice for ${money}, paid instantly.` })}</p>
        </div>
      );
    case "zelle":
      return (
        <div className={box}>
          <p className="font-semibold">{t({ es: "Zelle (simulado)", en: "Zelle (simulated)" })}</p>
          <p>{t({ es: `Enviarías ${money} a ${businessName} desde la app de tu banco.`, en: `You'd send ${money} to ${businessName} from your bank's app.` })}</p>
        </div>
      );
    case "usdt":
      return (
        <div className={box}>
          <p className="font-semibold">{t({ es: "USDT (simulado)", en: "USDT (simulated)" })}</p>
          <p>{t({ es: `El equivalente de ${money} en dólares digitales, a la billetera de ${businessName}.`, en: `The equivalent of ${money} in digital dollars, to ${businessName}'s wallet.` })}</p>
        </div>
      );
  }
}
