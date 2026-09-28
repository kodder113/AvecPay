import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { jsonError } from "@/lib/http";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, "Sign in required");
  const { error } = await supabase.from("recipients").delete().eq("id", id);
  // 23503 = still referenced by a transfer (kept for history).
  if (error?.code === "23503") return jsonError(409, "This recipient has transfers and cannot be deleted.");
  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}
