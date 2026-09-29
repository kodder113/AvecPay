import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MerchantSettings } from "@/components/cobros/MerchantSettings";
import { resolveMethods, type Method } from "@/lib/cobros/methods";

export default async function AjustesPage() {
  const supabase = await createClient();
  const { data: merchant } = await supabase
    .from("merchants")
    .select("business_name, partner_id, merchant_methods(method, enabled)")
    .maybeSingle();
  if (!merchant) redirect("/cobrar");
  const { data: partner } = await supabase.from("partners").select("allowed_methods").eq("id", merchant.partner_id).single();
  const allowed = resolveMethods(partner?.allowed_methods ?? [], partner?.allowed_methods ?? []);
  const enabled = (merchant.merchant_methods ?? []).filter((m) => m.enabled).map((m) => m.method as Method);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ajustes del comercio</h1>
      <MerchantSettings initialName={merchant.business_name} allowed={allowed} enabled={enabled} submitLabel="Guardar" redirectTo="/cobrar" />
    </div>
  );
}
