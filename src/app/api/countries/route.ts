import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { allProviders } from "@/lib/providers/registry";
import { handleRouteError, jsonError } from "@/lib/http";

/** Destination countries any configured provider reports as payout-enabled. */
export async function GET() {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Sign in required");
  try {
    const lists = await Promise.all(allProviders().map((p) => p.listPayoutCountries()));
    const byCode = new Map(lists.flat().map((c) => [c.code, c]));
    return NextResponse.json([...byCode.values()].sort((a, b) => a.name.localeCompare(b.name)));
  } catch (e) {
    return handleRouteError(e);
  }
}
