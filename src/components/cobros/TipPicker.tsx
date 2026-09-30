"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/cobros/parse";
import { TIP_PERCENTS, addMoney, parseTip, tipForPercent } from "@/lib/cobros/tip";
import { useT } from "@/components/i18n/LangProvider";

/**
 * No / 10% / 15% / 20% / Otro, with a subtotal–tip–total breakdown.
 * Reports the tip (0 when none) or null while a typed tip is invalid.
 */
export function TipPicker({ amount, currency, onChange }: { amount: number | string; currency: string; onChange: (tip: number | null) => void }) {
  const t = useT();
  const [choice, setChoice] = useState<number | "custom" | null>(null);
  const [custom, setCustom] = useState("");
  const tip = choice === null ? 0 : choice === "custom" ? parseTip(custom, amount) : tipForPercent(amount, choice);

  useEffect(() => onChange(tip), [tip, onChange]);

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">{t({ es: "¿Agregar propina?", en: "Add a tip?" })}</h2>
      <div className="grid grid-cols-5 gap-2">
        <TipButton active={choice === null} onClick={() => setChoice(null)} label={t({ es: "No", en: "No" })} />
        {TIP_PERCENTS.map((p) => (
          <TipButton key={p} active={choice === p} onClick={() => setChoice(p)} label={`${p}%`} sub={formatMoney(tipForPercent(amount, p), currency)} />
        ))}
        <TipButton active={choice === "custom"} onClick={() => setChoice("custom")} label={t({ es: "Otro", en: "Other" })} />
      </div>
      {choice === "custom" && (
        <div className="space-y-1">
          <input
            className="input"
            inputMode="decimal"
            autoFocus
            placeholder={t({ es: "Monto de propina, ej. 30", en: "Tip amount, e.g. 30" })}
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^0-9.,]/g, ""))}
            aria-label={t({ es: "Propina", en: "Tip" })}
          />
          {tip === null && <p className="text-xs text-red-600">{t({ es: `Escribe un monto válido, hasta ${formatMoney(amount, currency)}.`, en: `Enter a valid amount, up to ${formatMoney(amount, currency)}.` })}</p>}
        </div>
      )}
      <dl className="space-y-1 border-t border-slate-100 pt-3 text-sm">
        <div className="flex justify-between"><dt className="text-slate-500">{t({ es: "Subtotal", en: "Subtotal" })}</dt><dd>{formatMoney(amount, currency)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">{t({ es: "Propina", en: "Tip" })}</dt><dd>{formatMoney(tip ?? 0, currency)}</dd></div>
        <div className="flex justify-between text-base font-bold"><dt>{t({ es: "Total", en: "Total" })}</dt><dd>{formatMoney(addMoney(amount, tip ?? 0), currency)}</dd></div>
      </dl>
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
