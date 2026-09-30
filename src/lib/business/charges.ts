import "server-only";
import type { Db, MerchantRow } from "./context";
import { cardReady, cardStatus } from "./card";
import { liveMethods, resolveMethods, type Method } from "@/lib/cobros/methods";
import { isHandleMethod } from "@/lib/cobros/handles";
import { generateChargeCode } from "@/lib/cobros/code";

/**
 * Methods a new charge offers: partner switch ∩ merchant switch; in live
 * mode only methods that really move money (card once Stripe is connected,
 * handle apps once the handle is set).
 */
export async function chargeMethods(db: Db, m: MerchantRow): Promise<Method[]> {
  const [{ data: partner }, { data: rows }] = await Promise.all([
    db.from("partners").select("allowed_methods").eq("id", m.partner_id).single(),
    db.from("merchant_methods").select("method, enabled, details").eq("merchant_id", m.id),
  ]);
  const methods = rows ?? [];
  const enabled = methods.filter((r) => r.enabled).map((r) => r.method as string);
  let allowed = resolveMethods(partner?.allowed_methods ?? [], enabled);
  if (m.mode === "live") {
    const live = liveMethods(cardReady(await cardStatus(db, m)));
    const handle = (method: string) => Boolean((methods.find((r) => r.method === method)?.details as { handle?: string } | undefined)?.handle);
    allowed = allowed.filter((x) => live.includes(x) && (!isHandleMethod(x) || handle(x)) && (x !== "card" || m.currency === "USD"));
  }
  return allowed;
}

export interface NewCharge {
  amount: number;
  description?: string | null;
  kind: "quick" | "ticket" | "link";
  ticketRef?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  createdBy?: string | null;
  payLinkId?: string | null;
  tipOnly?: boolean;
  /** Minutes the QR stays open (quick: 30; tickets: days). */
  validMinutes: number;
}

/** Inserts a charge with a fresh unique code (retries on the rare collision). */
export async function insertCharge(db: Db, m: MerchantRow, allowed: Method[], c: NewCharge): Promise<{ id: string; code: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("charges")
      .insert({
        merchant_id: m.id,
        code: generateChargeCode(),
        mode: m.mode,
        amount: c.amount,
        currency: m.currency,
        description: c.description || null,
        allowed_methods: allowed,
        tips_allowed: c.tipOnly ? false : m.tips_enabled,
        kind: c.kind,
        ticket_ref: c.ticketRef || null,
        customer_name: c.customerName || null,
        customer_email: c.customerEmail || null,
        created_by: c.createdBy ?? null,
        pay_link_id: c.payLinkId ?? null,
        tip_only: Boolean(c.tipOnly),
        expires_at: new Date(Date.now() + c.validMinutes * 60_000).toISOString(),
      })
      .select("id, code")
      .single();
    if (!error && data) return data as { id: string; code: string };
    if (error?.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique code");
}
