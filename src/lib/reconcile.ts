import type { ProviderOrder } from "@/lib/providers/types";
import { transitionPath, type TransferStatus } from "@/lib/status";

/** The subset of a transfers row that reconciliation needs. */
export interface TransferSnapshot {
  id: string;
  status: TransferStatus;
  crypto_currency_code: string;
  crypto_amount: number | string;
  provider_transaction_id: string | null;
  deposit_address: string | null;
  deposit_address_tag: string | null;
}

export interface ReconcileResult {
  /** Columns to write to the transfer. */
  update: Record<string, unknown>;
  /** Statuses to append to the history, in order. */
  events: TransferStatus[];
  /** Set when the order was rejected or ignored; its deposit address is never exposed. */
  rejection: string | null;
}

/**
 * Pure reconciliation of a provider order into an AvecPay transfer.
 *
 * Safety rules (the sender must only ever be shown a deposit address that
 * belongs to *this* order):
 *   1. The order must reference this transfer and match its asset and amount.
 *   2. A transfer is bound to one provider order and one deposit address for
 *      its whole life. A different id or address later is rejected.
 *   3. A deposit address already used by any other transfer is rejected.
 */
export function reconcileOrder(
  transfer: TransferSnapshot,
  order: ProviderOrder,
  depositAddressUsedElsewhere: boolean,
): ReconcileResult {
  const reject = (reason: string): ReconcileResult => ({
    update: { status: "failed", failure_reason: reason, provider_raw: order.raw },
    events: transitionPath(transfer.status, "failed"),
    rejection: reason,
  });

  if (order.externalTransactionId && order.externalTransactionId !== transfer.id) {
    return reject("Provider order references a different transfer.");
  }
  // Binding a new order requires the provider to echo this transfer's id back.
  if (!transfer.provider_transaction_id && order.externalTransactionId !== transfer.id) {
    return reject("Provider order is not linked to this transfer.");
  }
  if (transfer.provider_transaction_id && transfer.provider_transaction_id !== order.providerTransactionId) {
    // A duplicate order (e.g. the recipient opened the provider flow twice).
    // The transfer stays bound to its first order; the duplicate is ignored
    // and its address is never shown. Unfunded, it expires at the provider.
    return { update: {}, events: [], rejection: "Ignored a second provider order for this transfer." };
  }
  if (order.assetCode && order.assetCode !== transfer.crypto_currency_code) {
    return reject(`Provider order asset (${order.assetCode}) does not match transfer (${transfer.crypto_currency_code}).`);
  }
  if (order.cryptoAmount != null && Math.abs(order.cryptoAmount - Number(transfer.crypto_amount)) > 1e-9) {
    return reject(`Provider order amount (${order.cryptoAmount}) does not match transfer (${transfer.crypto_amount}).`);
  }

  const update: Record<string, unknown> = {
    provider_transaction_id: order.providerTransactionId,
    provider_raw: order.raw,
  };

  if (order.depositAddress) {
    if (transfer.deposit_address) {
      const sameTag = (transfer.deposit_address_tag ?? null) === (order.depositAddressTag ?? null);
      if (transfer.deposit_address !== order.depositAddress || !sameTag) {
        return reject("Provider changed the deposit address for this order.");
      }
    } else {
      if (depositAddressUsedElsewhere) {
        return reject("Provider returned a deposit address already used by another transfer.");
      }
      update.deposit_address = order.depositAddress;
      update.deposit_address_tag = order.depositAddressTag;
    }
  }

  if (order.depositHash) update.deposit_hash = order.depositHash;
  if (order.fiatCurrency) update.final_fiat_currency = order.fiatCurrency;
  if (order.fiatAmount != null) update.final_fiat_amount = order.fiatAmount;
  if (order.failureReason) update.failure_reason = order.failureReason;

  // "Awaiting USDT" means the sender can pay now, which needs an address.
  const hasAddress = Boolean(transfer.deposit_address || update.deposit_address);
  const target = order.status === "awaiting_usdt" && !hasAddress ? transfer.status : order.status;

  const events = transitionPath(transfer.status, target);
  if (events.length) update.status = events[events.length - 1];

  return { update, events, rejection: null };
}

/** Picks the order a transfer is (or should be) bound to: the bound one, else the oldest. */
export function pickBoundOrder<T extends { providerTransactionId: string }>(
  orders: T[],
  boundId: string | null,
): T | null {
  if (boundId) return orders.find((o) => o.providerTransactionId === boundId) ?? null;
  return orders[0] ?? null;
}
