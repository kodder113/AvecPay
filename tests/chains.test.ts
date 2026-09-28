import { describe, expect, it } from "vitest";
import {
  isAddressForChain,
  isTxHashForChain,
  resolveWalletPayContract,
  toBaseUnits,
  trimAmount,
  usdtChainForNetwork,
} from "@/lib/chains";

describe("toBaseUnits", () => {
  it("converts exact decimal strings without rounding", () => {
    expect(toBaseUnits("10", 6)).toBe(10_000_000n);
    expect(toBaseUnits("10.000000000000000000", 6)).toBe(10_000_000n); // DB numeric(36,18)
    expect(toBaseUnits("10.5", 6)).toBe(10_500_000n);
    expect(toBaseUnits("0.000001", 6)).toBe(1n);
    expect(toBaseUnits("10", 18)).toBe(10n * 10n ** 18n); // USDT on BNB Smart Chain
  });
  it("refuses amounts it would have to round, and junk", () => {
    expect(() => toBaseUnits("0.0000001", 6)).toThrow(/decimals/);
    expect(() => toBaseUnits("-1", 6)).toThrow();
    expect(() => toBaseUnits("1e3", 6)).toThrow();
  });
});

describe("trimAmount", () => {
  it("only trims zeros after a decimal point", () => {
    expect(trimAmount("10")).toBe("10");
    expect(trimAmount("100")).toBe("100");
    expect(trimAmount("10.000000000000000000")).toBe("10");
    expect(trimAmount("10.50")).toBe("10.5");
  });
});

describe("resolveWalletPayContract", () => {
  const tron = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  const polygon = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
  it("allows wallet pay only with the official contract", () => {
    expect(resolveWalletPayContract("tron", tron, true)).toBe(tron);
    expect(resolveWalletPayContract("polygon", polygon.toLowerCase(), false)).toBe(polygon);
  });
  it("stays manual for testnet/other contracts, unknown networks, or unverified sandbox", () => {
    expect(resolveWalletPayContract("polygon", "0x0000000000000000000000000000000000000001", true)).toBeNull();
    expect(resolveWalletPayContract("solana", null, true)).toBeNull();
    expect(resolveWalletPayContract("tron", null, false)).toBeNull();
    expect(resolveWalletPayContract("tron", null, true)).toBe(tron);
  });
});

describe("address and hash checks", () => {
  it("matches each chain's format", () => {
    expect(isAddressForChain("TJk8vQm3Rz5Nq2WbX7hFpL4sYd9GcA1uE6", "tron")).toBe(true);
    expect(isAddressForChain("0xdAC17F958D2ee523a2206206994597C13D831ec7", "tron")).toBe(false);
    expect(isAddressForChain("0xdAC17F958D2ee523a2206206994597C13D831ec7", "evm")).toBe(true);
    expect(isTxHashForChain("0x" + "a".repeat(64), "evm")).toBe(true);
    expect(isTxHashForChain("a".repeat(64), "tron")).toBe(true);
    expect(isTxHashForChain("a".repeat(64), "evm")).toBe(false);
  });
  it("knows BNB Smart Chain USDT has 18 decimals", () => {
    expect(usdtChainForNetwork("binance_smart_chain")?.decimals).toBe(18);
    expect(usdtChainForNetwork("TRON")?.kind).toBe("tron");
  });
});
