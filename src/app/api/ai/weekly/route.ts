import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/business/context";
import { generateWeeklyReport } from "@/lib/ai/weekly";
import { AiUnavailable, aiConfigured } from "@/lib/ai/claude";
import { jsonError } from "@/lib/http";

export const maxDuration = 60;

/** Make this week's AI report now (Business plan; at most once an hour). */
export async function POST() {
  const g = await requireBusiness({ roles: ["owner", "manager"], access: true, feature: "ai" });
  if (!g.ok) return g.res;
  const { db, t, lang, user, business } = g.ctx;
  if (!aiConfigured()) return jsonError(503, t({ es: "Los reportes con IA aún no están activados.", en: "AI reports aren't activated yet." }));
  const { data: last } = await db
    .from("ai_reports")
    .select("created_at")
    .eq("merchant_id", business.merchant.id)
    .eq("kind", "weekly")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && Date.now() - new Date(last.created_at).getTime() < 3600_000) {
    return jsonError(429, t({ es: "Ya hiciste un reporte en la última hora.", en: "You made a report in the last hour." }));
  }
  try {
    const answer = await generateWeeklyReport(db, business.merchant, lang, user.id);
    return NextResponse.json({ answer });
  } catch (e) {
    console.error("ai weekly", e);
    return jsonError(502, e instanceof AiUnavailable ? t({ es: "La IA no pudo hacer el reporte ahora. Intenta más tarde.", en: "The AI couldn't make the report right now. Try later." }) : t({ es: "Algo salió mal.", en: "Something went wrong." }));
  }
}
