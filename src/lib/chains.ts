/**
 * Official USDT token contracts per network, keyed by MoonPay's `networkCode`.
 * Used only for paying from the sender's own wallet; the send is always
 * wallet → provider deposit address, never through Avec Pay.
 */
export type ChainKind = "evm" | "tron";

export interface UsdtChain {
  kind: ChainKind;
  label: string;
  /** EVM chain id (unused for Tron). */
  chainId: number | null;
  contract: string;
  decimals: number;
}

const ETHEREUM: UsdtChain = { kind: "evm", label: "Ethereum", chainId: 1, contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 };
const POLYGON: UsdtChain = { kind: "evm", label: "Polygon", chainId: 137, contract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 };
const ARBITRUM: UsdtChain = { kind: "evm", label: "Arbitrum", chainId: 42161, contract: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 };
const OPTIMISM: UsdtChain = { kind: "evm", label: "Optimism", chainId: 10, contract: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 };
// USDT on BNB Smart Chain uses 18 decimals, unlike the other networks.
const BSC: UsdtChain = { kind: "evm", label: "BNB Smart Chain", chainId: 56, contract: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 };
const AVALANCHE: UsdtChain = { kind: "evm", label: "Avalanche", chainId: 43114, contract: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 };
const TRON: UsdtChain = { kind: "tron", label: "Tron", chainId: null, contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6 };

const BY_NETWORK: Record<string, UsdtChain> = {
  ethereum: ETHEREUM,
  polygon: POLYGON,
  arbitrum: ARBITRUM,
  optimism: OPTIMISM,
  binance_smart_chain: BSC,
  bnb_chain: BSC,
  bsc: BSC,
  avalanche_c_chain: AVALANCHE,
  avalanche: AVALANCHE,
  tron: TRON,
};

export function usdtChainForNetwork(network: string | null | undefined): UsdtChain | null {
  return network ? (BY_NETWORK[network.toLowerCase()] ?? null) : null;
}

function sameAddress(a: string, b: string, kind: ChainKind): boolean {
  return kind === "evm" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/**
 * Decides whether a transfer may be paid from a connected wallet, and with
 * which token contract. Returns null (copy-paste only) unless we are sure the
 * contract is right for where the provider expects the deposit:
 *   - the network must be one we know;
 *   - if the provider reports a contract, it must equal the official one
 *     (a sandbox/testnet contract never matches, so sandbox stays manual);
 *   - if it reports none, only production is trusted.
 */
export function resolveWalletPayContract(
  network: string | null | undefined,
  providerContract: string | null | undefined,
  isProduction: boolean,
): string | null {
  const chain = usdtChainForNetwork(network);
  if (!chain) return null;
  if (providerContract) return sameAddress(providerContract, chain.contract, chain.kind) ? chain.contract : null;
  return isProduction ? chain.contract : null;
}

/** Exact decimal string → token base units. Never rounds: too many decimals is an error. */
export function toBaseUnits(amount: string | number, decimals: number): bigint {
  const s = String(amount).trim();
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`Invalid amount: ${s}`);
  const whole = m[1];
  const fraction = (m[2] ?? "").replace(/0+$/, "");
  if (fraction.length > decimals) throw new Error(`Amount ${s} has more than ${decimals} decimals`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

export function isAddressForChain(address: string, kind: ChainKind): boolean {
  return kind === "evm" ? /^0x[0-9a-fA-F]{40}$/.test(address) : /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

export function isTxHashForChain(hash: string, kind: ChainKind): boolean {
  return kind === "evm" ? /^0x[0-9a-fA-F]{64}$/.test(hash) : /^[0-9a-fA-F]{64}$/.test(hash);
}

export function shortAddress(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** "10.000000000000000000" → "10", "10.50" → "10.5". Only trims after a decimal point. */
export function trimAmount(amount: string | number): string {
  const s = String(amount);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
