/**
 * AvecPay's provider-independent transfer lifecycle.
 * Providers map their own statuses onto these in their adapter.
 */
export const TRANSFER_STATUSES = [
  "created",
  "awaiting_usdt",
  "usdt_received",
  "processing",
  "payout_initiated",
  "completed",
  "failed",
] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export const STATUS_LABELS: Record<TransferStatus, string> = {
  created: "Created",
  awaiting_usdt: "Awaiting USDT",
  usdt_received: "USDT received",
  processing: "Processing",
  payout_initiated: "Payout initiated",
  completed: "Completed",
  failed: "Failed",
};

/** The happy-path order; `failed` is terminal and can happen at any point. */
export const HAPPY_PATH: TransferStatus[] = TRANSFER_STATUSES.filter((s) => s !== "failed");

export function isTerminal(status: TransferStatus): boolean {
  return status === "completed" || status === "failed";
}

/**
 * Statuses only move forward. Returns the statuses to record, in order, when
 * moving from `current` to `next` (so skipped intermediate steps still show up
 * in the history). Returns [] when `next` would be a regression or a no-op.
 */
export function transitionPath(current: TransferStatus, next: TransferStatus): TransferStatus[] {
  if (isTerminal(current)) return [];
  if (next === "failed") return ["failed"];
  const from = HAPPY_PATH.indexOf(current);
  const to = HAPPY_PATH.indexOf(next);
  if (to <= from) return [];
  return HAPPY_PATH.slice(from + 1, to + 1);
}
