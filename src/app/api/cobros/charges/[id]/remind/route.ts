import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/business/context";
import { visibleCharge } from "@/lib/business/visibility";
import { REMINDER_COLUMNS, sendTicketReminder, type ReminderCharge } from "@/lib/business/reminders";
import { emailConfigured } from "@/lib/email";
import { jsonError } from "@/lib/http";

/** Email the customer a reminder with the pay link (Business plan). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireBusiness({ access: true, feature: "unpaid_tickets" });
  if (!g.ok) return g.res;
  const { db, t, user, business } = g.ctx;
  if (!emailConfigured()) return jsonError(503, t({ es: "El correo de Avec aún no está configurado.", en: "Avec email isn't set up yet." }));
  const charge = await visibleCharge<ReminderCharge>(db, business, user.id, id, REMINDER_COLUMNS);
  if (!charge) return jsonError(404, t({ es: "Cobro no encontrado", en: "Charge not found" }));
  if (!charge.customer_email) return jsonError(400, t({ es: "Este ticket no tiene correo del cliente.", en: "This ticket has no customer email." }));
  const r = await sendTicketReminder(db, charge, business.merchant.business_name, new URL(req.url).origin);
  if (!r.sent) return jsonError(r.error === "not_pending" ? 409 : 502, r.error === "not_pending" ? t({ es: "Este ticket ya no está pendiente.", en: "This ticket is no longer pending." }) : t({ es: "No se pudo enviar el correo.", en: "Couldn't send the email." }));
  return NextResponse.json({ ok: true });
}
