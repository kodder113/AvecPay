import "server-only";
import type { Business, Db } from "./context";
import { seesAllCharges } from "./context";

/** A charge the caller may see: their business's, and for staff only their own. */
export async function visibleCharge<T = Record<string, unknown>>(db: Db, business: Business, userId: string, id: string, columns: string): Promise<T | null> {
  let q = db.from("charges").select(columns).eq("id", id).eq("merchant_id", business.merchant.id);
  if (!seesAllCharges(business.role)) q = q.eq("created_by", userId);
  const { data } = await q.maybeSingle();
  return (data as T | null) ?? null;
}

/** What the merchant's charge screen shows. */
export const CHARGE_VIEW_COLUMNS =
  "id, code, mode, kind, status, amount, tip_amount, currency, description, ticket_ref, customer_name, customer_email, reported_at, paid_method, paid_reference, payer_name, paid_at, expires_at, tip_only";
