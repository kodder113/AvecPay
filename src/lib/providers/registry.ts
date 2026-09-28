import type { PayoutProvider } from "./types";
import { MoonPayProvider, moonPayConfigFromEnv } from "./moonpay/provider";

/**
 * Provider registry. To add a provider: implement PayoutProvider, register a
 * factory here, and (optionally) route corridors to it in `providerForCorridor`.
 */
const factories: Record<string, () => PayoutProvider> = {
  moonpay: () => new MoonPayProvider(moonPayConfigFromEnv()),
};

const cache = new Map<string, PayoutProvider>();

export function getProvider(id: string): PayoutProvider {
  const factory = factories[id];
  if (!factory) throw new Error(`Unknown payout provider: ${id}`);
  let p = cache.get(id);
  if (!p) {
    p = factory();
    cache.set(id, p);
  }
  return p;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function providerForCorridor(countryCode: string): PayoutProvider {
  // Single provider for the MVP. Corridor-based routing goes here later.
  return getProvider("moonpay");
}

export function allProviders(): PayoutProvider[] {
  return Object.keys(factories).map(getProvider);
}
