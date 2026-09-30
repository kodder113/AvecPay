"use client";
import { useState } from "react";
import Link from "next/link";
import { METHOD_INFO, type Method } from "@/lib/cobros/methods";
import { formatMoney } from "@/lib/cobros/parse";
import { TIP_PERCENTS, addMoney, parseTip, tipForPercent } from "@/lib/cobros/tip";

interface Props {
  code: string;
  amount: number | string;
  currency: string;
  businessName: string;
  methods: Method[];
  demoAccount: { account_number: string; balance: number | string } | null;
  tipsAllowed: boolean;
}

const ICON: Record<Method, string> = { bank_transfer: "🏦", tigo_money: "📱", card: "💳", lightning: "⚡", usdt: "💵" };

/** Customer flow: pick a method, see its (simulated) screen, pay from Banco Demo. */
export function PayFlow({ code, amount, currency, businessName, methods, demoAccount, tipsAllowed }: Props) {
  const [method, setMethod] = useState<Method | null>(methods.length === 1 ? methods[0] : null);
  const [stage, setStage] = useState<"choose" | "processing" | "done">("choose");
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  // Tip: a suggested percentage, a typed amount ("custom"), or none.
  const [tipChoice, setTipChoice] = useState<number | "custom" | null>(null);
  const [customTip, setCustomTip] = useState("");
  const tip =
    !tipsAllowed || tipChoice === null ? 0 : tipChoice === "custom" ? parseTip(customTip, amount) : tipForPercent(amount, tipChoice);
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
      return setError(body.error ?? "No se pudo completar el pago");
    }
    setReference(body.reference);
    setStage("done");
  }

  if (stage === "done") {
    return (
      <div className="card space-y-3 border-emerald-300 bg-emerald-50 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-4xl text-white">✓</div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Pago enviado</p>
        <p className="text-3xl font-black">{money}</p>
        {tip ? <p className="text-sm text-slate-600">incluye propina de {formatMoney(tip, currency)} · ¡gracias!</p> : null}
        <p className="text-slate-700">a <b>{businessName}</b></p>
        <p className="text-sm text-slate-600">Referencia <span className="font-mono font-semibold">{reference}</span></p>
        <Link href="/banco-demo" className="btn-secondary w-full">Ver mi Banco Demo</Link>
      </div>
    );
  }

  if (stage === "processing") {
    return (
      <div className="card space-y-3 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand-ink" />
        <p className="font-semibold">Procesando con Banco Demo…</p>
        <p className="text-sm text-slate-500">{method && METHOD_INFO[method].label} · {money}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="font-semibold">¿Cómo quieres pagar?</h2>
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
                <span className="block font-medium">{METHOD_INFO[m].label}</span>
                <span className="block text-xs text-slate-500">{METHOD_INFO[m].description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {tipsAllowed && (
        <div className="card space-y-3">
          <h2 className="font-semibold">¿Agregar propina?</h2>
          <div className="grid grid-cols-5 gap-2">
            <TipButton active={tipChoice === null} onClick={() => setTipChoice(null)} label="No" />
            {TIP_PERCENTS.map((p) => (
              <TipButton key={p} active={tipChoice === p} onClick={() => setTipChoice(p)} label={`${p}%`} sub={formatMoney(tipForPercent(amount, p), currency)} />
            ))}
            <TipButton active={tipChoice === "custom"} onClick={() => setTipChoice("custom")} label="Otro" />
          </div>
          {tipChoice === "custom" && (
            <div className="space-y-1">
              <input
                className="input"
                inputMode="decimal"
                autoFocus
                placeholder="Monto de propina, ej. 30"
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value.replace(/[^0-9.,]/g, ""))}
                aria-label="Propina"
              />
              {tip === null && <p className="text-xs text-red-600">Escribe un monto válido, hasta {formatMoney(amount, currency)}.</p>}
            </div>
          )}
          <dl className="space-y-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{formatMoney(amount, currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Propina</dt><dd>{formatMoney(tip ?? 0, currency)}</dd></div>
            <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{money}</dd></div>
          </dl>
        </div>
      )}

      {method && <MethodScreen method={method} money={money} businessName={businessName} code={code} account={demoAccount?.account_number ?? null} />}

      {error && <p className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</p>}

      {demoAccount ? (
        <div className="space-y-2">
          <button type="button" className="btn-primary w-full py-4 text-base" disabled={!method || tip === null} onClick={pay}>
            Pagar {money}
          </button>
          <p className="text-center text-xs text-slate-500">
            Se descuenta de tu Banco Demo ({demoAccount.account_number}) · saldo {formatMoney(demoAccount.balance)}
          </p>
        </div>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(`/pagar/${code}`)}`} className="btn-primary w-full py-4 text-base">
          Inicia sesión para pagar
        </Link>
      )}
    </div>
  );
}

function TipButton({ active, onClick, label, sub }: { active: boolean; onClick: () => void; label: string; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-xl border-2 px-1 py-2 text-sm font-semibold ${active ? "border-brand-ink bg-brand-yellow" : "border-slate-200"}`}
    >
      {label}
      {sub && <span className="text-[10px] font-normal text-slate-600">{sub}</span>}
    </button>
  );
}

/** What each method looks like. In demo, every one is simulated by Banco Demo. */
function MethodScreen({ method, money, businessName, code, account }: { method: Method; money: string; businessName: string; code: string; account: string | null }) {
  const box = "card space-y-1 text-sm text-slate-700";
  switch (method) {
    case "bank_transfer":
      return (
        <div className={box}>
          <p className="font-semibold">Transferencia ACH Pronto (simulada)</p>
          <p>Desde: Banco Demo {account ?? ""}</p>
          <p>Para: {businessName}</p>
          <p>Referencia del cobro: <span className="font-mono">{code}</span></p>
        </div>
      );
    case "tigo_money":
      return (
        <div className={box}>
          <p className="font-semibold">Tigo Money (simulado)</p>
          <p>Pagarás {money} a {businessName} desde tu billetera Tigo Money de prueba.</p>
        </div>
      );
    case "card":
      return (
        <div className={box}>
          <p className="font-semibold">Tarjeta o Apple Pay (simulado)</p>
          <p className="font-mono">•••• •••• •••• 4242 · 12/29</p>
          <p className="text-xs text-slate-500">En modo demo no se usa ninguna tarjeta real.</p>
        </div>
      );
    case "lightning":
      return (
        <div className={box}>
          <p className="font-semibold">Bitcoin Lightning (simulado)</p>
          <p className="break-all font-mono text-xs text-slate-500">lnbc{code.toLowerCase()}demo1p…</p>
          <p>Factura por {money}, pagada al instante.</p>
        </div>
      );
    case "usdt":
      return (
        <div className={box}>
          <p className="font-semibold">USDT (simulado)</p>
          <p>El equivalente de {money} en dólares digitales, a la billetera de {businessName}.</p>
        </div>
      );
  }
}
