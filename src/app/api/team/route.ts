import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/business/context";
import { hasFeature, PLANS, planWith, seatsFor } from "@/lib/business/plans";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";

const body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().max(60).optional(),
  role: z.enum(["manager", "staff"]),
});

/**
 * Owner invites a team member by email. They join by signing in with that
 * email. Plan seats: Starter 1, Team 5, Business 15.
 */
export async function POST(req: Request) {
  const g = await requireBusiness({ roles: ["owner"], access: true });
  if (!g.ok) return g.res;
  const { db, t, lang, business } = g.ctx;
  const m = business.merchant;
  if (!hasFeature(m.plan, "team")) {
    return jsonError(402, t({ es: `Invitar a tu equipo está en el plan ${PLANS[planWith("team")].name}`, en: `Inviting your team is on the ${PLANS[planWith("team")].name} plan` }));
  }
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Escribe un correo válido", en: "Enter a valid email" }));
  const { email, name, role } = parsed.data;

  const { count } = await db.from("merchant_members").select("id", { count: "exact", head: true }).eq("merchant_id", m.id);
  const seats = seatsFor(m.plan);
  if ((count ?? 0) >= seats) {
    return jsonError(402, t({ es: `Tu plan permite ${seats} usuarios. Mejora tu plan para agregar más.`, en: `Your plan allows ${seats} users. Upgrade to add more.` }));
  }
  // One business per person: someone already on another team can't be invited.
  const { data: elsewhere } = await db.from("merchant_members").select("merchant_id").eq("email", email).not("user_id", "is", null).maybeSingle();
  if (elsewhere && elsewhere.merchant_id !== m.id) {
    return jsonError(409, t({ es: "Ese correo ya pertenece a otro negocio en Avec.", en: "That email already belongs to another business on Avec." }));
  }
  const { data, error } = await db
    .from("merchant_members")
    .insert({ merchant_id: m.id, email, display_name: name || null, role, status: "invited" })
    .select("id")
    .single();
  if (error) return jsonError(error.code === "23505" ? 409 : 500, error.code === "23505" ? t({ es: "Esa persona ya está en tu equipo.", en: "That person is already on your team." }) : error.message);

  const joinUrl = `${new URL(req.url).origin}/login?next=/cobrar`;
  const who = escapeHtml(m.business_name);
  const sent = await sendEmail({
    to: email,
    subject: lang === "es" ? `Te invitaron a ${m.business_name} en Avec Pay` : `You're invited to ${m.business_name} on Avec Pay`,
    html: emailLayout(
      lang === "es" ? `Únete a ${m.business_name}` : `Join ${m.business_name}`,
      lang === "es"
        ? `<p><b>${who}</b> te agregó a su equipo en Avec Pay para cobrar con QR. Entra con este correo (<b>${escapeHtml(email)}</b>) y te llega un código.</p>`
        : `<p><b>${who}</b> added you to their team on Avec Pay to take payments by QR. Sign in with this email (<b>${escapeHtml(email)}</b>) and you'll get a code.</p>`,
      { label: lang === "es" ? "Entrar a Avec Pay" : "Sign in to Avec Pay", url: joinUrl },
    ),
  });
  return NextResponse.json({ id: data.id, emailed: sent.sent, joinUrl }, { status: 201 });
}
