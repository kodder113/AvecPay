"use client";
/**
 * Minimal TronLink integration (browser extension, or the TronLink app's
 * built-in browser on mobile). No SDK: TronLink injects `window.tronWeb`.
 */

interface TronContract {
  transfer(to: string, amount: string): { send(opts: { feeLimit: number }): Promise<string> };
  balanceOf(owner: string): { call(): Promise<{ toString(): string }> };
}

interface TronWebLike {
  defaultAddress?: { base58?: string | false };
  fullNode?: { host?: string };
  contract(): { at(address: string): Promise<TronContract> };
}

declare global {
  interface Window {
    tronLink?: { request(args: { method: string }): Promise<{ code?: number; message?: string } | undefined> };
    tronWeb?: TronWebLike;
  }
}

export function hasTronLink(): boolean {
  return typeof window !== "undefined" && Boolean(window.tronLink || window.tronWeb);
}

function tronWeb(): TronWebLike {
  if (!window.tronWeb) throw new Error("TronLink not found. Install TronLink, or open this page in the TronLink app.");
  return window.tronWeb;
}

/** Asks TronLink for access and returns the connected mainnet address. */
export async function connectTron(): Promise<string> {
  if (!hasTronLink()) throw new Error("TronLink not found. Install TronLink, or open this page in the TronLink app.");
  if (window.tronLink?.request) {
    const res = await window.tronLink.request({ method: "tron_requestAccounts" });
    if (res && res.code !== undefined && res.code !== 200) throw new Error(res.message || "TronLink connection was rejected");
  }
  const tw = tronWeb();
  const host = tw.fullNode?.host ?? "";
  if (/shasta|nile/i.test(host)) throw new Error("TronLink is on a test network. Switch it to Tron mainnet.");
  const address = tw.defaultAddress?.base58;
  if (!address) throw new Error("Unlock TronLink and try again.");
  return address;
}

export async function tronUsdtBalance(contract: string, owner: string): Promise<bigint> {
  const c = await tronWeb().contract().at(contract);
  return BigInt((await c.balanceOf(owner).call()).toString());
}

/** Sends a TRC-20 transfer from the connected TronLink wallet; returns the tx id. */
export async function sendTronUsdt(contract: string, to: string, amount: bigint): Promise<string> {
  const c = await tronWeb().contract().at(contract);
  // feeLimit caps the TRX the sender can burn on energy (100 TRX, in sun).
  return c.transfer(to, amount.toString()).send({ feeLimit: 100_000_000 });
}
