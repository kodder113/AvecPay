import { loadBusiness } from "@/lib/business/context";
import { cardReady, cardStatus } from "@/lib/business/card";
import { hasFeature } from "@/lib/business/plans";
import { gatePage, SharingBanner } from "@/components/business/Gate";
import { ChargeForm } from "@/components/cobros/ChargeForm";
import { MerchantSettings } from "@/components/cobros/MerchantSettings";
import { ModePill } from "@/components/cobros/DemoPill";
import { METHODS, liveMethods, resolveMethods } from "@/lib/cobros/methods";

export default async function CobrarPage() {
  const ctx = await loadBusiness();
  const { t, db, business } = ctx;

  if (!business) {
    const { data: partner } = await db.from("partners").select("allowed_methods").eq("id", "avec").single();
    const allowed = resolveMethods(partner?.allowed_methods ?? [], METHODS);
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{t({ es: "Crea tu negocio", en: "Create your business" })}</h1>
          <p className="text-slate-600">
            {t({
              es: "Configúralo una vez. Después eliges tu plan y ya puedes cobrar con QR.",
              en: "Set it up once. Then pick your plan and start getting paid by QR.",
            })}
          </p>
        </div>
        <MerchantSettings
          initial={{ name: "", enabled: allowed.filter((m) => m === "card" || m === "zelle"), tipsEnabled: true, mode: "demo", currency: "USD", handles: {}, zelleName: "" }}
          allowed={allowed}
          liveMethods={liveMethods(false)}
          submitLabel={t({ es: "Crear mi negocio", en: "Create my business" })}
          redirectTo="/cobrar/plan"
        />
      </div>
    );
  }

  const gate = gatePage(ctx, { access: true });
  if (gate) return gate;
  const m = business.merchant;
  const card = await cardStatus(db, m);

  return (
    <div className="space-y-4">
      <SharingBanner ctx={ctx} />
      <div className="space-y-1">
        <ModePill mode={m.mode} />
        <h1 className="text-2xl font-bold">{m.business_name}</h1>
      </div>
      <ChargeForm currencySymbol={m.currency === "HNL" ? "L" : "$"} tickets={hasFeature(m.plan, "ticket_qr")} />
      <p className="text-center text-xs text-slate-500">
        {m.mode === "live"
          ? cardReady(card)
            ? t({ es: "Modo real: tarjeta, Apple Pay y Google Pay llegan a tu Stripe; Zelle y apps, directo a ti.", en: "Live mode: card, Apple Pay and Google Pay go to your Stripe; Zelle and apps come straight to you." })
            : t({ es: "Modo real: tus clientes te pagan directo (Zelle, Venmo, Cash App, PayPal).", en: "Live mode: customers pay you directly (Zelle, Venmo, Cash App, PayPal)." })
          : t({ es: "Modo demo: los pagos usan cuentas de Banco Demo con dinero de prueba.", en: "Demo mode: payments use Demo Bank accounts with play money." })}
      </p>
    </div>
  );
}
