/**
 * Preflight: asks MoonPay (with your keys) whether a corridor works, before
 * any UI is involved. Nothing here is assumed; every value is from MoonPay.
 *
 *   npm run moonpay:check -- --country HN --amount 10
 *   npm run moonpay:check -- --country HN --amount 10 --fiat usd
 */
import { existsSync } from "fs";
import { MoonPayProvider, moonPayConfigFromEnv } from "../src/lib/providers/moonpay/provider";
import { getFeePolicy } from "../src/lib/fees";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const country = (arg("country", "HN") ?? "HN").toUpperCase();
  const amount = Number(arg("amount", "10"));
  const onlyFiat = arg("fiat")?.toLowerCase();

  const cfg = moonPayConfigFromEnv();
  const mp = new MoonPayProvider(cfg);
  console.log(`MoonPay ${cfg.env} · country ${country} · ${amount} USDT · payout method ${cfg.payoutMethod}\n`);

  const corridor = await mp.getCorridor(country);
  console.log(`Country: ${corridor.country.name ?? "not listed"} · sell allowed: ${corridor.country.sellAllowed}`);
  console.log(`USDT assets available: ${corridor.assets.map((a) => `${a.code} (${a.network}) min ${a.minSellAmount} max ${a.maxSellAmount}`).join(", ") || "none"}`);
  console.log(`Sell fiat currencies: ${corridor.fiatCurrencies.map((f) => f.code).join(", ") || "none"}`);
  if (corridor.blockers.length) {
    console.log("\nBLOCKERS:");
    corridor.blockers.forEach((b) => console.log(`  - ${b}`));
    process.exitCode = 1;
    return;
  }

  const fiats = onlyFiat ? corridor.fiatCurrencies.filter((f) => f.code === onlyFiat) : corridor.fiatCurrencies;
  if (!fiats.length) {
    console.log(`\n${onlyFiat} is not a MoonPay sell currency.`);
    process.exitCode = 1;
    return;
  }

  console.log("\nQuotes:");
  for (const asset of corridor.assets) {
    if (asset.minSellAmount != null && amount < asset.minSellAmount) {
      console.log(`  ${asset.code}: ${amount} is below MoonPay's minimum of ${asset.minSellAmount}`);
      continue;
    }
    for (const fiat of fiats) {
      try {
        const q = await mp.getQuote({ assetCode: asset.code, cryptoAmount: amount, fiatCurrency: fiat.code, payoutMethod: cfg.payoutMethod, fee: getFeePolicy() });
        console.log(
          `  ${asset.code} -> ${q.fiatCurrency}: rate ${q.exchangeRate} · MoonPay fee ${q.providerFee} · network fee ${q.networkFee ?? "n/a"} · AvicPay fee ${q.avicpayFee} · recipient gets ${q.recipientAmount} ${q.fiatCurrency}`,
        );
      } catch (e) {
        console.log(`  ${asset.code} -> ${fiat.code}: ${(e as Error).message}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
