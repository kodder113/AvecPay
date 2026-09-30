import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MerchantSettings } from "@/components/cobros/MerchantSettings";
import { resolveMethods, type Method } from "@/lib/cobros/methods";

export default async function AjustesPage() {
  const supabase = await createClient();
  const { data: merchant } = await supabase
    .from("merchants")
    .select("business_name, partner_id, tips_enabled, mode, currency, merchant_methods(method, enabled, details)")
    .maybeSingle();
  if (!merchant) redirect("/cobrar");
  const { data: partner } = await supabase.from("partners").select("allowed_methods").eq("id", merchant.partner_id).single();
  const allowed = resolveMethods(partner?.allowed_methods ?? [], partner?.allowed_methods ?? []);
  const methods = merchant.merchant_methods ?? [];
  const zelle = (methods.find((m) => m.method === "zelle")?.details ?? {}) as { handle?: string; name?: string };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ajustes del comercio</h1>
      <MerchantSettings
        initial={{
          name: merchant.business_name,
          enabled: methods.filter((m) => m.enabled).map((m) => m.method as Method),
          tipsEnabled: merchant.tips_enabled,
          mode: merchant.mode,
          currency: merchant.currency,
          zelleHandle: zelle.handle ?? "",
          zelleName: zelle.name ?? "",
        }}
        allowed={allowed}
        submitLabel="Guardar"
        redirectTo="/cobrar"
      />
    </div>
  );
}
