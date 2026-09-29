import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChargeForm } from "@/components/cobros/ChargeForm";
import { MerchantSettings } from "@/components/cobros/MerchantSettings";
import { DemoPill } from "@/components/cobros/DemoPill";
import { METHODS, resolveMethods } from "@/lib/cobros/methods";

export default async function CobrarPage() {
  const supabase = await createClient();
  const { data: merchant } = await supabase.from("merchants").select("business_name, currency").maybeSingle();

  if (!merchant) {
    const { data: partner } = await supabase.from("partners").select("allowed_methods").eq("id", "avec").single();
    const allowed = resolveMethods(partner?.allowed_methods ?? [], METHODS);
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <DemoPill />
          <h1 className="text-2xl font-bold">Empieza a cobrar</h1>
          <p className="text-slate-600">Configura tu negocio una vez. Después solo escribes el monto y muestras el QR.</p>
        </div>
        <MerchantSettings initialName="" allowed={allowed} enabled={allowed} submitLabel="Crear mi comercio" redirectTo="/cobrar" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <DemoPill />
          <h1 className="text-2xl font-bold">{merchant.business_name}</h1>
        </div>
        <div className="flex gap-3 pt-6 text-sm font-medium">
          <Link href="/cobrar/historial" className="text-brand-ink underline">Historial</Link>
          <Link href="/cobrar/ajustes" className="text-brand-ink underline">Ajustes</Link>
        </div>
      </div>
      <ChargeForm currencySymbol={merchant.currency === "HNL" ? "L" : merchant.currency} />
      <p className="text-center text-xs text-slate-500">
        Modo demo: los pagos usan cuentas de Banco Demo con dinero de prueba.
      </p>
    </div>
  );
}
