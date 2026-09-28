import type { TransferStatus } from "@/lib/status";

/**
 * Maps a MoonPay sell transaction to Avec Pay's lifecycle.
 *
 * MoonPay documents four sell statuses: waitingForDeposit, pending, completed,
 * failed. `depositHash` is set once MoonPay has received the deposit.
 *
 *   waitingForDeposit            -> awaiting_usdt
 *   pending, no depositHash      -> awaiting_usdt   (deposit not yet confirmed)
 *   pending, depositHash present -> processing      (implies usdt_received)
 *   completed                    -> completed       (MoonPay has sent the payout)
 *   failed                       -> failed
 *
 * MoonPay does not report a separate "payout initiated" state for sells, so
 * Avec Pay records payout_initiated and completed together when MoonPay reports
 * completion (see transitionPath). Card arrival can lag completion; MoonPay
 * quotes minutes to 2 business days.
 */
export function mapMoonPaySellStatus(tx: { status?: string | null; depositHash?: string | null }): TransferStatus {
  switch (tx.status) {
    case "waitingForDeposit":
      return "awaiting_usdt";
    case "pending":
      return tx.depositHash ? "processing" : "awaiting_usdt";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      // Unknown status: don't guess. Keep the transfer where it is.
      return "created";
  }
}
