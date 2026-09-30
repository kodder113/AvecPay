import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/providers/registry";
import { applyProviderOrder, pickBoundOrder } from "@/lib/transfers";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * MoonPay redirects here after the recipient finishes the sell flow. The query
 * string (transactionId, depositWalletAddress, …) is untrusted: we only use the
 * transaction id to look the order up via the authenticated API, then verify
 * it belongs to this transfer before storing anything.
 */
export default async function ClaimReturn({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const { transactionId } = await searchParams;
  const db = createAdminClient();
  const { t: tr } = await getT();
  const { data: t } = await db.from("transfers").select("id, provider, provider_transaction_id").eq("claim_token", token).single();
  if (!t) notFound();

  let message = tr({
    es: "¡Gracias! Tu pago está configurado. Se le pidió al remitente que envíe los USDT.",
    en: "Thanks! Your payout is set up. The sender has been asked to send the USDT.",
  });
  try {
    const provider = getProvider(t.provider);
    const order = transactionId
      ? await provider.getOrder(transactionId)
      : pickBoundOrder(await provider.listOrdersByTransferId(t.id), t.provider_transaction_id);
    if (!order) {
      message = tr({
        es: "Aún no encontramos tu orden de MoonPay. Si completaste los pasos de MoonPay, aparecerá en breve.",
        en: "We couldn’t find your MoonPay order yet. If you completed the MoonPay steps, it will appear shortly.",
      });
    } else if (order.externalTransactionId !== t.id) {
      message = tr({
        es: "Esta orden de MoonPay no pertenece a este envío.",
        en: "This MoonPay order doesn’t belong to this transfer.",
      });
    } else {
      const { rejection } = await applyProviderOrder(t.id, order, "redirect");
      if (rejection)
        message = tr({
          es: `Hubo un problema con esta orden: ${rejection}`,
          en: `There was a problem with this order: ${rejection}`,
        });
    }
  } catch (e) {
    console.error(e);
    message = tr({
      es: "No pudimos confirmar tu orden de MoonPay en este momento. Se actualizará automáticamente.",
      en: "We couldn’t confirm your MoonPay order right now. It will update automatically.",
    });
  }

  return (
    <div className="card space-y-3">
      <h1 className="text-xl font-semibold">{tr({ es: "Configuración de MoonPay completa", en: "MoonPay setup complete" })}</h1>
      <p className="text-slate-600">{message}</p>
      <Link href={`/r/${token}`} className="btn-secondary w-full">
        {tr({ es: "Ver estado", en: "View status" })}
      </Link>
    </div>
  );
}
