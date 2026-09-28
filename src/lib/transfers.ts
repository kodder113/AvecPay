import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProviderOrder } from "@/lib/providers/types";
import { reconcileOrder, type TransferSnapshot } from "@/lib/reconcile";

export { pickBoundOrder } from "@/lib/reconcile";

export type EventSource = "system" | "webhook" | "poll" | "redirect";

const SNAPSHOT_COLUMNS =
  "id, status, provider, crypto_currency_code, crypto_amount, provider_transaction_id, deposit_address, deposit_address_tag";

/**
 * Applies a provider order to its AvicPay transfer and records status history.
 * Safe to call repeatedly (webhooks, polling and redirects may all race).
 */
export async function applyProviderOrder(
  transferId: string,
  order: ProviderOrder,
  source: EventSource,
): Promise<{ rejection: string | null }> {
  // Optimistic concurrency: webhooks, polling and redirects can race, so each
  // write is conditional on the status we read. Retry on a lost race.
  for (let attempt = 0; attempt < 3; attempt++) {
    const outcome = await tryApply(transferId, order, source);
    if (outcome) return outcome;
  }
  throw new Error(`Could not apply provider order to transfer ${transferId}: too much contention`);
}

async function tryApply(
  transferId: string,
  order: ProviderOrder,
  source: EventSource,
): Promise<{ rejection: string | null } | null> {
  const db = createAdminClient();
  const { data: transfer, error } = await db
    .from("transfers")
    .select(SNAPSHOT_COLUMNS)
    .eq("id", transferId)
    .single<TransferSnapshot & { provider: string }>();
  if (error || !transfer) throw new Error(`Transfer ${transferId} not found`);

  let usedElsewhere = false;
  if (order.depositAddress && !transfer.deposit_address) {
    let q = db
      .from("transfers")
      .select("id", { count: "exact", head: true })
      .eq("provider", transfer.provider)
      .eq("crypto_currency_code", transfer.crypto_currency_code)
      .eq("deposit_address", order.depositAddress)
      .neq("id", transferId);
    q = order.depositAddressTag ? q.eq("deposit_address_tag", order.depositAddressTag) : q.is("deposit_address_tag", null);
    const { count, error: countErr } = await q;
    if (countErr) throw countErr;
    usedElsewhere = (count ?? 0) > 0;
  }

  let result = reconcileOrder(transfer, order, usedElsewhere);
  if (!Object.keys(result.update).length) {
    console.warn(`transfer ${transferId}: ${result.rejection} (provider order ${order.providerTransactionId})`);
    return { rejection: result.rejection };
  }
  let write = await db
    .from("transfers")
    .update(result.update)
    .eq("id", transferId)
    .eq("status", transfer.status)
    .select("id");

  // 23505 = unique violation: the DB index caught deposit address reuse.
  if (write.error?.code === "23505") {
    result = reconcileOrder(transfer, order, true);
    write = await db
      .from("transfers")
      .update(result.update)
      .eq("id", transferId)
      .eq("status", transfer.status)
      .select("id");
  }
  if (write.error) throw write.error;
  if (!write.data?.length) return null; // status changed underneath us; retry

  if (result.events.length) {
    const { error: evErr } = await db.from("transfer_events").insert(
      result.events.map((status) => ({
        transfer_id: transferId,
        status,
        source,
        detail: {
          provider_status: order.providerStatus,
          provider_transaction_id: order.providerTransactionId,
          ...(result.rejection ? { rejection: result.rejection } : {}),
        },
      })),
    );
    if (evErr) throw evErr;
  }

  return { rejection: result.rejection };
}

