import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PayFlow } from "@/components/cobros/PayFlow";
import { ModePill } from "@/components/cobros/DemoPill";
import { LivePayFlow } from "@/components/cobros/LivePayFlow";
import { formatMoney } from "@/lib/cobros/parse";
import { isMethod } from "@/lib/cobros/methods";

export const dynamic = "force-dynamic";

/** Public page a customer lands on after scanning the merchant's QR. */
export default async function PagarPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ pagado?: string }>;
}) {
  const { code: raw } = await params;
  const returnedFromCard = (await searchParams).pagado === "1";
  const code = raw.toUpperCase();
  const valid = /^[A-Z2-9]{8}$/.test(code);

  const { data: charge } = valid
    ? await createAdminClient()
        .from("charges")
        .select("code, mode, status, amount, currency, description, allowed_methods, tips_allowed, expires_at, merchant_id, merchants(business_name)")
        .eq("code", code)
        .maybeSingle()
    : { data: null };

  if (!charge) {
    return <p className="card text-slate-700">Este cobro no existe. Revisa el QR o pide uno nuevo.</p>;
  }

  const merchant = (Array.isArray(charge.merchants) ? charge.merchants[0] : charge.merchants) as { business_name: string } | null;
  const businessName = merchant?.business_name ?? "Comercio";
  const expired = new Date(charge.expires_at) < new Date();

  const live = charge.mode === "live";
  let zelle: { handle: string; name: string } | null = null;
  if (live && (charge.allowed_methods as string[]).includes("zelle")) {
    const { data: m } = await createAdminClient()
      .from("merchant_methods")
      .select("details")
      .eq("merchant_id", charge.merchant_id)
      .eq("method", "zelle")
      .maybeSingle();
    const d = (m?.details ?? {}) as { handle?: string; name?: string };
    if (d.handle) zelle = { handle: d.handle, name: d.name || businessName };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let demoAccount: { account_number: string; balance: number } | null = null;
  if (user && !live) {
    const { data } = await supabase.rpc("demo_ensure_account");
    if (data) demoAccount = { account_number: data.account_number, balance: data.balance };
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-1 text-center">
        <ModePill mode={charge.mode} />
        <p className="pt-2 text-sm text-slate-500">Pagar a</p>
        <h1 className="text-2xl font-bold">{businessName}</h1>
        <p className="text-4xl font-black">{formatMoney(charge.amount, charge.currency)}</p>
        {charge.description && <p className="text-sm text-slate-600">{charge.description}</p>}
      </div>

      {charge.status === "reported" ? (
        <p className="card text-center text-slate-700">Pago reportado. Esperando que el comercio lo confirme.</p>
      ) : charge.status === "paid" ? (
        returnedFromCard ? (
          <div className="card space-y-2 border-emerald-300 bg-emerald-50 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-4xl text-white">✓</div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Pago confirmado</p>
            <p className="text-slate-700">{businessName} recibió tu pago. ¡Gracias!</p>
          </div>
        ) : (
          <p className="card text-center font-semibold text-emerald-700">Este cobro ya fue pagado. ✓</p>
        )
      ) : charge.status === "cancelled" ? (
        <p className="card text-center text-slate-700">El comercio canceló este cobro.</p>
      ) : expired ? (
        <p className="card text-center text-slate-700">Este cobro venció. Pide un nuevo QR.</p>
      ) : live ? (
        <LivePayFlow
          code={charge.code}
          amount={charge.amount}
          currency={charge.currency}
          businessName={businessName}
          tipsAllowed={charge.tips_allowed}
          zelle={zelle}
          card={(charge.allowed_methods as string[]).includes("card")}
          returned={returnedFromCard}
        />
      ) : (
        <PayFlow
          code={charge.code}
          amount={charge.amount}
          currency={charge.currency}
          businessName={businessName}
          methods={(charge.allowed_methods as string[]).filter(isMethod)}
          demoAccount={demoAccount}
          tipsAllowed={charge.tips_allowed}
        />
      )}
    </div>
  );
}
