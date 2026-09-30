import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessState, type BillingFields } from "@/lib/business/access";
import { ModePill } from "@/components/cobros/DemoPill";
import { AmountEntry } from "@/components/business/AmountEntry";

export const dynamic = "force-dynamic";

/** Permanent QR (counter, desk, tip jar): the customer types the amount. */
export default async function PermanentQrPage({ params }: { params: Promise<{ code: string }> }) {
  const { t } = await getT();
  const { code } = await params;
  const { data: link } = /^[A-Za-z2-9]{8}$/.test(code)
    ? await createAdminClient()
        .from("pay_links")
        .select("code, kind, label, active, merchants(business_name, currency, mode, plan, subscription_status, access_until, past_due_since)")
        .eq("code", code.toUpperCase())
        .maybeSingle()
    : { data: null };
  const merchant = (link && (Array.isArray(link.merchants) ? link.merchants[0] : link.merchants)) as
    | (BillingFields & { business_name: string; currency: string; mode: string })
    | null;
  if (!link || !merchant || !link.active) {
    return <p className="card text-center text-slate-700">{t({ es: "Este QR ya no está activo.", en: "This QR is no longer active." })}</p>;
  }
  const open = accessState(merchant).ok;
  const tip = link.kind === "tip";
  return (
    <div className="space-y-4">
      <div className="card space-y-1 text-center">
        <ModePill mode={merchant.mode} />
        <p className="pt-2 text-sm text-slate-500">{tip ? t({ es: "Deja una propina para", en: "Leave a tip for" }) : t({ es: "Pagar a", en: "Pay" })}</p>
        <h1 className="text-2xl font-bold">{merchant.business_name}</h1>
        {link.label && <p className="font-semibold text-slate-700">{link.label}</p>}
      </div>
      {open ? (
        <AmountEntry code={link.code} currency={merchant.currency} tip={tip} />
      ) : (
        <p className="card text-center text-slate-700">{t({ es: "Este negocio no está aceptando pagos ahora.", en: "This business isn't accepting payments right now." })}</p>
      )}
    </div>
  );
}
