import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { METHODS } from "@/lib/cobros/methods";
import { payErrorMessage } from "@/lib/cobros/parse";
import { jsonError } from "@/lib/http";
import { getT } from "@/lib/i18n/server";

const body = z.object({
  code: z.string().regex(/^[A-Za-z2-9]{8}$/),
  method: z.enum(METHODS),
  tip: z.number().min(0).max(1_000_000).default(0),
});

/**
 * Demo payment: Banco Demo moves the fake money between the two users' demo
 * accounts and confirms the charge, atomically, inside the database.
 */
export async function POST(req: Request) {
  const { lang, t } = await getT();
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, payErrorMessage("not_authenticated", lang));
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Datos inválidos", en: "Invalid data" }));
  const { data, error } = await supabase.rpc("demo_pay_charge", {
    p_code: parsed.data.code,
    p_method: parsed.data.method,
    p_tip: parsed.data.tip,
  });
  if (error) return jsonError(400, payErrorMessage(error.message, lang));
  return NextResponse.json(data);
}
