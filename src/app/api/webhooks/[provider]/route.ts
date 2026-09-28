import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/providers/registry";
import { applyProviderOrder } from "@/lib/transfers";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  let provider;
  try {
    provider = getProvider(providerId);
  } catch {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const rawBody = await req.text();
  const db = createAdminClient();
  const result = await provider.handleWebhook(rawBody, req.headers).catch((e: unknown) => ({
    valid: true,
    eventType: null,
    order: null,
    payload: safeJson(rawBody),
    error: e instanceof Error ? e.message : String(e),
  }));

  const { data: logRow } = await db
    .from("webhook_events")
    .insert({
      provider: providerId,
      event_type: result.eventType,
      signature_valid: result.valid,
      payload: result.payload,
      error: result.error ?? null,
    })
    .select("id")
    .single();

  if (!result.valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  // Signature was valid but we could not load the order: ask the provider to retry.
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.order) return NextResponse.json({ ok: true, ignored: true });

  const order = result.order;
  let transferId = order.externalTransactionId;
  if (!transferId) {
    const { data } = await db
      .from("transfers")
      .select("id")
      .eq("provider", providerId)
      .eq("provider_transaction_id", order.providerTransactionId)
      .maybeSingle();
    transferId = data?.id ?? null;
  }
  if (!transferId) return NextResponse.json({ ok: true, ignored: "no matching transfer" });

  try {
    await applyProviderOrder(transferId, order, "webhook");
    if (logRow) await db.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", logRow.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (logRow) await db.from("webhook_events").update({ error: message }).eq("id", logRow.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
