import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { providerForCorridor } from "@/lib/providers/registry";
import { countryCode } from "@/lib/validation";
import { handleRouteError, jsonError } from "@/lib/http";

/** Live capabilities for a destination country, straight from the provider. */
export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Sign in required");
  try {
    const cc = countryCode.parse(req.nextUrl.searchParams.get("country") ?? "");
    const corridor = await providerForCorridor(cc).getCorridor(cc);
    return NextResponse.json(corridor);
  } catch (e) {
    return handleRouteError(e);
  }
}
