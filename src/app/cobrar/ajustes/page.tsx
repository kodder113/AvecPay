import { loadBusiness } from "@/lib/business/context";
import { cardReady, cardStatus } from "@/lib/business/card";
import { gatePage } from "@/components/business/Gate";
import { MerchantSettings } from "@/components/cobros/MerchantSettings";
import { liveMethods, resolveMethods, type Method } from "@/lib/cobros/methods";
import { HANDLE_METHODS, type HandleMethod } from "@/lib/cobros/handles";
import { getConnectedAccount } from "@/lib/stripe";

export default async function AjustesPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const ctx = await loadBusiness();
  const gate = gatePage(ctx, { roles: ["owner"] });
  if (gate) return gate;
  const { t, db } = ctx;
  const m = ctx.business!.merchant;

  // Back from Stripe's sign-up: refresh the account status right away.
  if ((await searchParams).stripe === "return" && m.stripe_account_id) {
    try {
      const acct = await getConnectedAccount(m.stripe_account_id);
      m.stripe_charges_enabled = Boolean(acct.charges_enabled);
      m.stripe_details_submitted = Boolean(acct.details_submitted);
      await db
        .from("merchants")
        .update({ stripe_charges_enabled: m.stripe_charges_enabled, stripe_details_submitted: m.stripe_details_submitted })
        .eq("id", m.id);
    } catch (e) {
      console.error("stripe account refresh", e);
    }
  }

  const [{ data: partner }, { data: methods }, card] = await Promise.all([
    db.from("partners").select("allowed_methods").eq("id", m.partner_id).single(),
    db.from("merchant_methods").select("method, enabled, details").eq("merchant_id", m.id),
    cardStatus(db, m),
  ]);
  const allowed = resolveMethods(partner?.allowed_methods ?? [], partner?.allowed_methods ?? []);
  const rows = methods ?? [];
  const detail = (method: string) => (rows.find((r) => r.method === method)?.details ?? {}) as { handle?: string; name?: string };
  const handles: Partial<Record<HandleMethod, string>> = {};
  for (const h of HANDLE_METHODS) if (detail(h).handle) handles[h] = detail(h).handle;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t({ es: "Ajustes del negocio", en: "Business settings" })}</h1>
      <MerchantSettings
        initial={{
          name: m.business_name,
          enabled: rows.filter((r) => r.enabled).map((r) => r.method as Method),
          tipsEnabled: m.tips_enabled,
          mode: m.mode,
          currency: m.currency as "HNL" | "USD",
          handles,
          zelleName: detail("zelle").name ?? "",
        }}
        allowed={allowed}
        liveMethods={liveMethods(cardReady(card))}
        card={card}
        submitLabel={t({ es: "Guardar", en: "Save" })}
        redirectTo="/cobrar"
      />
    </div>
  );
}
