import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/cobros/parse";
import { METHOD_INFO, isMethod } from "@/lib/cobros/methods";
import { ResetDemoButton } from "@/components/cobros/ResetDemoButton";

export const dynamic = "force-dynamic";

/**
 * Banco Demo: a separate, pretend bank. It's where demo money lives, the way
 * a merchant's real money lives in their real bank, not in Avec.
 */
export default async function BancoDemoPage() {
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

  if (!account) return <p className="card">No se pudo abrir tu cuenta de Banco Demo.</p>;

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-5 text-white shadow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black tracking-tight">🏦 Banco Demo</p>
            <p className="text-xs text-emerald-100">Banco ficticio para pruebas · no es Avec</p>
          </div>
          <ResetDemoButton />
        </div>
        <div>
          <p className="text-sm text-emerald-100">Saldo disponible</p>
          <p className="text-4xl font-black">{formatMoney(account.balance, account.currency)}</p>
        </div>
        <div className="text-sm text-emerald-100">
          <p>{account.holder_name}</p>
          <p className="font-mono">{account.account_number}</p>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Movimientos</h2>
        {!movements?.length ? (
          <p className="text-sm text-slate-500">Todavía no hay movimientos.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {movements.map((m) => {
              const incoming = m.to_account === account.id;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{incoming ? `De ${m.from_name}` : `A ${m.to_name}`}</p>
                    <p className="text-xs text-slate-500">
                      {isMethod(m.method) ? METHOD_INFO[m.method].short : m.method} · ref {m.reference} · {formatDateTime(m.created_at)}
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
