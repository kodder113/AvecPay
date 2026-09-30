import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { providerForCorridor } from "@/lib/providers/registry";
import { checkAgainstCorridor, quoteInput } from "@/lib/validation";
import { getFeePolicy } from "@/lib/fees";
import { handleRouteError, jsonError } from "@/lib/http";
import { getT } from "@/lib/i18n/server";

export async function POST(req: Request) {
  const { t } = await getT();
  const { user } = await requireUser();
  if (!user) return jsonError(401, t({ es: "Debes iniciar sesión", en: "Sign in required" }));
  try {
    const input = quoteInput.parse(await req.json());
    const provider = providerForCorridor(input.countryCode);
    const corridor = await provider.getCorridor(input.countryCode);
    const { problems } = checkAgainstCorridor(corridor, input);
    if (problems.length) return jsonError(422, t({ es: "No disponible", en: "Not supported" }), problems);

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
