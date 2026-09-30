import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { payErrorMessage } from "@/lib/cobros/parse";
import { jsonError } from "@/lib/http";

const body = z.object({
  code: z.string().regex(/^[A-Za-z2-9]{8}$/),
  tip: z.number().min(0).max(1_000_000).default(0),
  payerName: z.string().trim().max(60).optional(),
});

/**
 * Customer says "Ya pagué" after sending Zelle from their own bank app.
 * No Avec account needed. The charge waits for the merchant to confirm.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, "Datos inválidos");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("live_report_payment", {
    p_code: parsed.data.code,
    p_tip: parsed.data.tip,
    p_payer_name: parsed.data.payerName ?? "",
  });
  if (error) return jsonError(400, payErrorMessage(error.message));
  return NextResponse.json(data);
}
