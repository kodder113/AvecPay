"use client";
import { QrImage } from "./QrLinks";
import { useT } from "@/components/i18n/LangProvider";

const BRANDS: Record<string, string> = { card: "Card · Apple Pay · Google Pay", zelle: "Zelle", venmo: "Venmo", cashapp: "Cash App", paypal: "PayPal" };

/** Letter-size sign: logo, business, big QR, bilingual call to action. */
export function PrintSign({ code, tip, business, label, member, methods }: { code: string; tip: boolean; business: string; label: string | null; member: string | null; methods: string[] }) {
  const t = useT();
  const accepted = methods.filter((m) => BRANDS[m]).map((m) => BRANDS[m]);
  return (
    <div className="space-y-4">
      <div className="flex gap-2 print:hidden">
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          🖨️ {t({ es: "Imprimir o guardar PDF", en: "Print or save as PDF" })}
        </button>
      </div>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border-4 border-brand-ink bg-white p-8 text-center print:max-w-none print:border-8 print:p-12">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/avecpay-mark.png" alt="" width={36} height={36} />
          <span className="text-2xl font-black italic">Avec Pay</span>
        </div>
        <p className="text-3xl font-black leading-tight">{business}</p>
        {(label || member) && <p className="text-lg font-semibold text-slate-600">{[label, member].filter(Boolean).join(" · ")}</p>}
        <QrImage code={code} size={900} className="w-full max-w-xs rounded-xl print:max-w-sm" />
        <p className="text-3xl font-black">{tip ? "Scan to tip 💛" : "Scan to pay"}</p>
        <p className="text-2xl font-bold text-slate-600">{tip ? "Escanea para dejar propina" : "Escanea para pagar"}</p>
        {accepted.length > 0 && <p className="text-sm text-slate-500">{accepted.join(" · ")}</p>}
        <p className="font-mono text-xs text-slate-400">{code}</p>
      </div>
    </div>
  );
}
