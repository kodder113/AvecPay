"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/LangProvider";

const TIP_PRESETS = [2, 5, 10, 20];

/** The customer types what they owe (or picks a tip), then pays as usual. */
export function AmountEntry({ code, currency, tip }: { code: string; currency: string; tip: boolean }) {
  const t = useT();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const symbol = currency === "HNL" ? "L" : "$";

  async function go(value: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/q/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: value }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.code) {
      setBusy(false);
      return setError(data.error ?? t({ es: "No se pudo continuar", en: "Couldn't continue" }));
    }
    router.push(`/pagar/${data.code}`);
  }

  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        go(amount);
      }}
    >
      {tip && (
        <div className="grid grid-cols-4 gap-2">
          {TIP_PRESETS.map((v) => (
            <button key={v} type="button" disabled={busy} onClick={() => go(String(v))} className="rounded-xl border-2 border-slate-200 py-3 text-lg font-bold hover:border-brand-ink">
              {symbol}
              {v}
            </button>
          ))}
        </div>
      )}
      <label className="label" htmlFor="amt">
        {tip ? t({ es: "U otro monto", en: "Or another amount" }) : t({ es: "¿Cuánto vas a pagar?", en: "How much are you paying?" })}
      </label>
      <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 px-4 focus-within:border-brand-ink">
        <span className="text-3xl font-bold text-slate-400">{symbol}</span>
        <input
          id="amt"
          inputMode="decimal"
          autoFocus={!tip}
          className="w-full bg-transparent py-4 text-4xl font-bold outline-none"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full py-4 text-base" disabled={!(Number(amount) > 0) || busy}>
        {busy ? t({ es: "Un momento…", en: "One moment…" }) : t({ es: "Continuar al pago", en: "Continue to payment" })}
      </button>
    </form>
  );
}
