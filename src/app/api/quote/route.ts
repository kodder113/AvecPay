import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { providerForCorridor } from "@/lib/providers/registry";
import { checkAgainstCorridor, quoteInput } from "@/lib/validation";
import { getFeePolicy } from "@/lib/fees";
import { handleRouteError, jsonError } from "@/lib/http";

export async function POST(req: Request) {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Sign in required");
  try {
    const input = quoteInput.parse(await req.json());
    const provider = providerForCorridor(input.countryCode);
    const corridor = await provider.getCorridor(input.countryCode);
    const { problems } = checkAgainstCorridor(corridor, input);
    if (problems.length) return jsonError(422, "Not supported", problems);

    const quote = await provider.getQuote({
      assetCode: input.assetCode,
      cryptoAmount: input.amount,
      fiatCurrency: input.fiatCurrency,
      payoutMethod: corridor.payoutMethod,
      fee: getFeePolicy(),
    });
    return NextResponse.json(quote);
  } catch (e) {
    return handleRouteError(e);
  }
}
