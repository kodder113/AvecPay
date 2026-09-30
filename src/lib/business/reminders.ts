import "server-only";
import type { Db } from "./context";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/cobros/parse";

export interface ReminderCharge {
  id: string;
  code: string;
  amount: number | string;
  currency: string;
  ticket_ref: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  reminders_sent: number;
  expires_at: string;
}

/**
 * Emails the customer a pay link for an open ticket and keeps the link open
 * for another 7 days. English with a Spanish line (we don't know their language).
 */
export async function sendTicketReminder(db: Db, charge: ReminderCharge, businessName: string, origin: string): Promise<{ sent: boolean; error?: string }> {
  if (!charge.customer_email) return { sent: false, error: "no_email" };
  if (charge.status !== "pending") return { sent: false, error: "not_pending" };
  const url = `${origin}/pagar/${charge.code}`;
  const amount = formatMoney(charge.amount, charge.currency);
  const who = escapeHtml(businessName);
  const ticket = charge.ticket_ref ? ` #${escapeHtml(charge.ticket_ref)}` : "";
  const result = await sendEmail({
    to: charge.customer_email,
    subject: `${businessName}: payment reminder${charge.ticket_ref ? ` for ticket #${charge.ticket_ref}` : ""} (${amount})`,
    html: emailLayout(
      `Payment reminder from ${businessName}`,
      `<p>Hi${charge.customer_name ? ` ${escapeHtml(charge.customer_name)}` : ""}, this is a friendly reminder from <b>${who}</b> about ticket${ticket}: <b>${escapeHtml(amount)}</b>.</p>
<p>You can pay by card, Apple Pay, Google Pay or your usual app, no account needed.</p>
<p style="color:#64748b;font-size:13px">Recordatorio de pago de ${who}: ${escapeHtml(amount)}. Puedes pagar con tarjeta, Apple Pay o tu app.</p>`,
      { label: `Pay ${amount}`, url },
    ),
  });
  if (!result.sent) return result;
  const extended = new Date(Math.max(new Date(charge.expires_at).getTime(), Date.now()) + 7 * 86_400_000).toISOString();
  await db
    .from("charges")
    .update({ reminders_sent: charge.reminders_sent + 1, last_reminder_at: new Date().toISOString(), expires_at: extended })
    .eq("id", charge.id)
    .eq("status", "pending");
  return { sent: true };
}

export const REMINDER_COLUMNS = "id, code, amount, currency, ticket_ref, customer_name, customer_email, status, reminders_sent, expires_at";
