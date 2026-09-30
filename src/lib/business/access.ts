/**
 * Whether a business may take payments and create QRs right now, from its
 * billing fields. Pure, so it can be unit-tested.
 */
export const GRACE_DAYS = 7;

export interface BillingFields {
  plan: string | null;
  subscription_status: string;
  access_until: string | null;
  past_due_since: string | null;
}

export type AccessState =
  | { ok: true; reason: "active" | "comped" | "trial" | "grace"; until: string | null }
  | { ok: false; reason: "no_plan" | "expired" | "canceled" | "past_due" };

export function accessState(m: BillingFields, now = new Date()): AccessState {
  if (!m.plan) return { ok: false, reason: "no_plan" };
  const until = m.access_until ? new Date(m.access_until) : null;
  switch (m.subscription_status) {
    case "active":
      return { ok: true, reason: "active", until: m.access_until };
    case "comped":
      return !until || until > now ? { ok: true, reason: "comped", until: m.access_until } : { ok: false, reason: "expired" };
    case "trialing":
      return until && until > now ? { ok: true, reason: "trial", until: m.access_until } : { ok: false, reason: "expired" };
    case "past_due": {
      const since = m.past_due_since ? new Date(m.past_due_since) : now;
      const graceEnd = new Date(since.getTime() + GRACE_DAYS * 86_400_000);
      return graceEnd > now ? { ok: true, reason: "grace", until: graceEnd.toISOString() } : { ok: false, reason: "past_due" };
    }
    case "canceled":
      // Canceled subscriptions keep access until the end of the paid period.
      return until && until > now ? { ok: true, reason: "active", until: m.access_until } : { ok: false, reason: "canceled" };
    default:
      return { ok: false, reason: "no_plan" };
  }
}
