import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/business/context";
import { answerQuestion } from "@/lib/ai/weekly";
import { AiUnavailable, aiConfigured } from "@/lib/ai/claude";
import { jsonError } from "@/lib/http";

export const maxDuration = 60;
const DAILY_LIMIT = 30;

/** Ask the AI a question about the business's own numbers (Business plan). */
export async function POST(req: Request) {
  const g = await requireBusiness({ roles: ["owner", "manager"], access: true, feature: "ai" });
  if (!g.ok) return g.res;
  const { db, t, lang, user, business } = g.ctx;
  if (!aiConfigured()) return jsonError(503, t({ es: "Las preguntas con IA aún no están activadas.", en: "AI questions aren't activated yet." }));
  const parsed = z.object({ question: z.string().trim().min(3).max(500) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Escribe tu pregunta", en: "Type your question" }));
  const { count } = await db
    .from("ai_reports")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", business.merchant.id)
    .eq("kind", "question")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) return jsonError(429, t({ es: "Llegaste al límite de preguntas de hoy.", en: "You've reached today's question limit." }));
  try {
    const answer = await answerQuestion(db, business.merchant, parsed.data.question, lang, user.id);
    return NextResponse.json({ answer });
  } catch (e) {
    console.error("ai ask", e);
    return jsonError(502, e instanceof AiUnavailable ? t({ es: "La IA no pudo responder ahora. Intenta más tarde.", en: "The AI couldn't answer right now. Try later." }) : t({ es: "Algo salió mal.", en: "Something went wrong." }));
  }
}
