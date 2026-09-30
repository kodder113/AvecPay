import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/cobros/parse";
import { methodInfo, isMethod } from "@/lib/cobros/methods";
import { getT } from "@/lib/i18n/server";
import { ResetDemoButton } from "@/components/cobros/ResetDemoButton";

export const dynamic = "force-dynamic";

/**
 * Banco Demo: a separate, pretend bank. It's where demo money lives, the way
 * a merchant's real money lives in their real bank, not in Avec.
 */
export default async function BancoDemoPage() {
  const { lang, t } = await getT();
  const supabase = await createClient();
  const { data: account } = await supabase.rpc("demo_ensure_account");
  const { data: movements } = account
    ? await supabase
        .from("demo_bank_transfers")
        .select("id, from_account, to_account, from_name, to_name, amount, reference, method, created_at")
        .or(`from_account.eq.${account.id},to_account.eq.${account.id}`)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  if (!account) return <p className="card">{t({ es: "No se pudo abrir tu cuenta de Banco Demo.", en: "Couldn't open your Demo Bank account." })}</p>;

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-5 text-white shadow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black tracking-tight">🏦 {t({ es: "Banco Demo", en: "Demo Bank" })}</p>
            <p className="text-xs text-emerald-100">{t({ es: "Banco ficticio para pruebas · no es Avec", en: "Pretend bank for testing · not Avec" })}</p>
          </div>
          <ResetDemoButton />
        </div>
        <div>
          <p className="text-sm text-emerald-100">{t({ es: "Saldo disponible", en: "Available balance" })}</p>
          <p className="text-4xl font-black">{formatMoney(account.balance, account.currency)}</p>
        </div>
        <div className="text-sm text-emerald-100">
          <p>{account.holder_name}</p>
          <p className="font-mono">{account.account_number}</p>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">{t({ es: "Movimientos", en: "Transactions" })}</h2>
        {!movements?.length ? (
          <p className="text-sm text-slate-500">{t({ es: "Todavía no hay movimientos.", en: "No transactions yet." })}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {movements.map((m) => {
              const incoming = m.to_account === account.id;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{incoming ? t({ es: `De ${m.from_name}`, en: `From ${m.from_name}` }) : t({ es: `A ${m.to_name}`, en: `To ${m.to_name}` })}</p>
                    <p className="text-xs text-slate-500">
                      {isMethod(m.method) ? methodInfo(lang)[m.method].short : m.method} · ref {m.reference} · {formatDateTime(m.created_at, lang)}
                    </p>
                  </div>
                  <p className={`whitespace-nowrap font-bold ${incoming ? "text-emerald-700" : "text-slate-800"}`}>
                    {incoming ? "+" : "−"}
                    {formatMoney(m.amount)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
