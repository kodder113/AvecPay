import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTxHashForChain, usdtChainForNetwork } from "@/lib/chains";
import { handleRouteError, jsonError } from "@/lib/http";
import { getT } from "@/lib/i18n/server";

const body = z.object({ txHash: z.string().trim().min(10).max(100) });

/**
 * Records the transaction the sender broadcast from their own wallet, so the
 * transfer page can show "payment sent" and never offer to pay twice.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t: tr } = await getT();
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, tr({ es: "Debes iniciar sesión", en: "Sign in required" }));
  try {
    const { txHash } = body.parse(await req.json());
    // RLS: only returns the row if the user owns it.
    const { data: t } = await supabase
      .from("transfers")
      .select("id, status, crypto_network, sender_tx_hash")
      .eq("id", id)
      .single();
    if (!t) return jsonError(404, tr({ es: "Envío no encontrado", en: "Transfer not found" }));
    const chain = usdtChainForNetwork(t.crypto_network);
    if (!chain || !isTxHashForChain(txHash, chain.kind)) return jsonError(400, tr({ es: "Hash de transacción no válido", en: "Invalid transaction hash" }));
    if (t.sender_tx_hash) return jsonError(409, tr({ es: "Ya se registró un pago para este envío", en: "A payment was already recorded for this transfer" }));

    const { data, error } = await createAdminClient()
      .from("transfers")
      .update({ sender_tx_hash: txHash })
      .eq("id", id)
      .is("sender_tx_hash", null)
      .select("id");
    if (error) throw error;
    if (!data?.length) return jsonError(409, tr({ es: "Ya se registró un pago para este envío", en: "A payment was already recorded for this transfer" }));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
