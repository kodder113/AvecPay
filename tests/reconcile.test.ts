import { describe, expect, it } from "vitest";
import { pickBoundOrder, reconcileOrder, type TransferSnapshot } from "@/lib/reconcile";
import type { ProviderOrder } from "@/lib/providers/types";

const transfer: TransferSnapshot = {
  id: "t1",
  status: "created",
  crypto_currency_code: "usdt_trx",
  crypto_amount: "10.000000000000000000",
  provider_transaction_id: null,
  deposit_address: null,
  deposit_address_tag: null,
};

const order = (o: Partial<ProviderOrder> = {}): ProviderOrder => ({
  providerTransactionId: "mp1",
  createdAt: "2026-01-01T00:00:00Z",
  externalTransactionId: "t1",
  status: "awaiting_usdt",
  providerStatus: "waitingForDeposit",
  depositAddress: "TXYZ",
  depositAddressTag: null,
  depositHash: null,
  assetCode: "usdt_trx",
  cryptoAmount: 10,
  fiatCurrency: "usd",
  fiatAmount: 9.5,
  failureReason: null,
  raw: {},
  ...o,
});

describe("reconcileOrder", () => {
  it("binds a matching order and exposes its deposit address", () => {
    const r = reconcileOrder(transfer, order(), false);
    expect(r.rejection).toBeNull();
    expect(r.update).toMatchObject({ deposit_address: "TXYZ", provider_transaction_id: "mp1", status: "awaiting_usdt" });
    expect(r.events).toEqual(["awaiting_usdt"]);
  });

  it("refuses a deposit address already used by another transfer", () => {
    const r = reconcileOrder(transfer, order(), true);
    expect(r.rejection).toMatch(/already used/);
    expect(r.update.deposit_address).toBeUndefined();
    expect(r.update.status).toBe("failed");
  });

  it("refuses an address change on a bound order", () => {
    const bound = { ...transfer, status: "awaiting_usdt" as const, provider_transaction_id: "mp1", deposit_address: "TXYZ" };
    const r = reconcileOrder(bound, order({ depositAddress: "TOTHER" }), false);
    expect(r.rejection).toMatch(/changed the deposit address/);
    expect(r.update.deposit_address).toBeUndefined();
  });

  it("refuses orders not linked to this transfer, or with a different amount/asset", () => {
    expect(reconcileOrder(transfer, order({ externalTransactionId: "other" }), false).rejection).toBeTruthy();
    expect(reconcileOrder(transfer, order({ externalTransactionId: null }), false).rejection).toBeTruthy();
    expect(reconcileOrder(transfer, order({ cryptoAmount: 50 }), false).rejection).toMatch(/amount/);
    expect(reconcileOrder(transfer, order({ assetCode: "usdt" }), false).rejection).toMatch(/asset/);
  });

  it("ignores a duplicate order without failing the transfer", () => {
    const bound = { ...transfer, status: "awaiting_usdt" as const, provider_transaction_id: "mp1", deposit_address: "TXYZ" };
    const r = reconcileOrder(bound, order({ providerTransactionId: "mp2", depositAddress: "TNEW" }), false);
    expect(r.update).toEqual({});
    expect(r.events).toEqual([]);
  });

  it("does not show 'Awaiting USDT' until there is an address", () => {
    const r = reconcileOrder(transfer, order({ depositAddress: null }), false);
    expect(r.events).toEqual([]);
    expect(r.update.status).toBeUndefined();
  });

  it("records every intermediate step on completion", () => {
    const bound = { ...transfer, status: "awaiting_usdt" as const, provider_transaction_id: "mp1", deposit_address: "TXYZ" };
    const r = reconcileOrder(bound, order({ status: "completed", providerStatus: "completed", depositHash: "h" }), false);
    expect(r.events).toEqual(["usdt_received", "processing", "payout_initiated", "completed"]);
    expect(r.update.deposit_hash).toBe("h");
  });
});

describe("pickBoundOrder", () => {
  const a = { providerTransactionId: "a" };
  const b = { providerTransactionId: "b" };
  it("prefers the bound order, else the oldest", () => {
    expect(pickBoundOrder([a, b], "b")).toBe(b);
    expect(pickBoundOrder([a, b], null)).toBe(a);
    expect(pickBoundOrder([a], "zzz")).toBeNull();
  });
});
