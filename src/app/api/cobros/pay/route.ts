import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { METHODS } from "@/lib/cobros/methods";
import { payErrorMessage } from "@/lib/cobros/parse";
import { jsonError } from "@/lib/http";

const body = z.object({ code: z.string().regex(/^[A-Za-z2-9]{8}$/), method: z.enum(METHODS) });

/**
 * Demo payment: Banco Demo moves the fake money between the two users' demo
 * accounts and confirms the charge, atomically, inside the database.
 */
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, payErrorMessage("not_authenticated"));
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, "Datos inválidos");
  const { data, error } = await supabase.rpc("demo_pay_charge", { p_code: parsed.data.code, p_method: parsed.data.method });
  if (error) return jsonError(400, payErrorMessage(error.message));
  return NextResponse.json(data);
}
