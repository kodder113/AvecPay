import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChargeForm } from "@/components/cobros/ChargeForm";
import { MerchantSettings } from "@/components/cobros/MerchantSettings";
import { stripeEnabledFor } from "@/lib/stripe";
import { DemoPill, ModePill } from "@/components/cobros/DemoPill";
import { DbError } from "@/components/cobros/DbError";
import { METHODS, liveMethods, resolveMethods } from "@/lib/cobros/methods";
import { getT } from "@/lib/i18n/server";

export default async function CobrarPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const live = liveMethods(stripeEnabledFor(user?.email));
  const { data: merchant, error } = await supabase.from("merchants").select("business_name, currency, mode").maybeSingle();
  if (error) return <DbError message={error.message} />;

  if (!merchant) {
    const { data: partner } = await supabase.from("partners").select("allowed_methods").eq("id", "avec").single();
    const allowed = resolveMethods(partner?.allowed_methods ?? [], METHODS);
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <DemoPill />
          <h1 className="text-2xl font-bold">{t({ es: "Empieza a cobrar", en: "Start taking payments" })}</h1>
          <p className="text-slate-600">
            {t({ es: "Configura tu negocio una vez. Después solo escribes el monto y muestras el QR.", en: "Set up your business once. After that, just type the amount and show the QR." })}
          </p>
        </div>
        <MerchantSettings
          initial={{ name: "", enabled: allowed.filter((m) => m !== "zelle"), tipsEnabled: true, mode: "demo", currency: "HNL", zelleHandle: "", zelleName: "" }}
          allowed={allowed}
        liveMethods={live}
          submitLabel={t({ es: "Crear mi comercio", en: "Create my business" })}
          redirectTo="/cobrar"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <ModePill mode={merchant.mode} />
          <h1 className="text-2xl font-bold">{merchant.business_name}</h1>
        </div>
        <div className="flex gap-3 pt-6 text-sm font-medium">
          <Link href="/cobrar/historial" className="text-brand-ink underline">{t({ es: "Historial", en: "History" })}</Link>
          <Link href="/cobrar/ajustes" className="text-brand-ink underline">{t({ es: "Ajustes", en: "Settings" })}</Link>
        </div>
      </div>
      <ChargeForm currencySymbol={merchant.currency === "HNL" ? "L" : "$"} />
      <p className="text-center text-xs text-slate-500">
        {merchant.mode === "live"
          ? t({
              es: "Modo real: el cliente te paga directo (Zelle a tu banco, o tarjeta por Stripe si está activado).",
              en: "Live mode: customers pay you directly (Zelle to your bank, or card via Stripe if it’s on).",
            })
          : t({ es: "Modo demo: los pagos usan cuentas de Banco Demo con dinero de prueba.", en: "Demo mode: payments use Demo Bank accounts with test money." })}
      </p>
    </div>
  );
}
