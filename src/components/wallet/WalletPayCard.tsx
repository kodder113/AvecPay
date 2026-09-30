"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { erc20Abi } from "viem";
import { useAccount, useConfig } from "wagmi";
import { readContract, switchChain, writeContract } from "wagmi/actions";
import { useAppKit } from "@reown/appkit/react";
import { WalletProvider, useEvmWalletEnabled } from "./WalletProvider";
import { connectTron, hasTronLink, sendTronUsdt, tronUsdtBalance } from "@/lib/wallet/tron";
import { useT } from "@/components/i18n/LangProvider";
import type { T } from "@/lib/i18n";
import { isAddressForChain, shortAddress, toBaseUnits, trimAmount, usdtChainForNetwork, type UsdtChain } from "@/lib/chains";

export interface WalletPayProps {
  transferId: string;
  network: string | null;
  contract: string | null;
  depositAddress: string;
  depositAddressTag: string | null;
  amount: string;
  senderTxHash: string | null;
}

export default function WalletPayCard(props: WalletPayProps) {
  return (
    <WalletProvider>
      <WalletPayInner {...props} />
    </WalletProvider>
  );
}

function WalletPayInner(p: WalletPayProps) {
  const t = useT();
  const evmEnabled = useEvmWalletEnabled();
  const chain = usdtChainForNetwork(p.network);

  if (p.senderTxHash) {
    return (
      <Box>
        <p className="font-semibold">{t({ es: "Pago enviado desde tu billetera", en: "Payment sent from your wallet" })}</p>
        <p className="break-all text-xs text-slate-600">
          {t({ es: `Transacción: ${p.senderTxHash}`, en: `Transaction: ${p.senderTxHash}` })}
        </p>
        <p className="text-sm text-slate-600">
          {t({ es: "MoonPay lo confirmará en breve. No lo envíes de nuevo.", en: "MoonPay will confirm it shortly. Don’t send again." })}
        </p>
      </Box>
    );
  }

  // Wallet pay only when the contract was verified at creation and nothing
  // unusual (memo/tag, unknown network, mismatched address) is involved.
  const reason = !chain
    ? t({ es: "esta red", en: "this network" })
    : !p.contract || p.contract !== chain.contract
      ? t({
          es: "este envío (modo sandbox, o no se pudo verificar el token de la red)",
          en: "this transfer (sandbox mode, or the network’s token couldn’t be verified)",
        })
      : p.depositAddressTag
        ? t({ es: "depósitos que requieren un memo", en: "deposits that need a memo" })
        : !isAddressForChain(p.depositAddress, chain.kind)
          ? t({ es: "esta dirección de depósito", en: "this deposit address" })
          : null;
  if (reason || !chain) {
    return (
      <Box>
        <p className="text-sm text-slate-600">
          {t({
            es: `Pagar desde una billetera conectada no está disponible para ${reason}. Mejor copia la dirección de arriba.`,
            en: `Paying from a connected wallet isn’t available for ${reason}. Copy the address above instead.`,
          })}
        </p>
      </Box>
    );
  }
  if (chain.kind === "evm" && !evmEnabled) {
    return (
      <Box>
        <p className="text-sm text-slate-600">
          {t({
            es: "La conexión de billetera aún no está configurada. Mejor copia la dirección de arriba.",
            en: "Wallet connection isn’t configured yet. Copy the address above instead.",
          })}
        </p>
      </Box>
    );
  }
  return chain.kind === "evm" ? <EvmPay chain={chain} {...p} /> : <TronPay chain={chain} {...p} />;
}

function Box({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 rounded-xl border border-amber-200 bg-white p-4">{children}</div>;
}

function usePayFlow(p: WalletPayProps, chain: UsdtChain) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(from: string, getBalance: () => Promise<bigint>, send: (amount: bigint) => Promise<string>) {
    setBusy(true);
    setError(null);
    try {
      const amount = toBaseUnits(p.amount, chain.decimals);
      if ((await getBalance()) < amount) throw new Error(
          t({
            es: `No hay suficientes USDT en ${chain.label} en ${shortAddress(from)}.`,
            en: `Not enough USDT on ${chain.label} in ${shortAddress(from)}.`,
          }),
        );
      const ok = window.confirm(
        t({
          es: `Envía exactamente ${trimAmount(p.amount)} USDT en ${chain.label}\n\ndesde ${from}\na la dirección de depósito de MoonPay ${p.depositAddress}\n\nTu billetera te pedirá que lo apruebes.`,
          en: `Send exactly ${trimAmount(p.amount)} USDT on ${chain.label}\n\nfrom ${from}\nto MoonPay deposit address ${p.depositAddress}\n\nYour wallet will ask you to approve it.`,
        }),
      );
      if (!ok) return;
      const txHash = await send(amount);
      const res = await fetch(`/api/transfers/${p.transferId}/sender-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      if (!res.ok) {
        // The payment went out; only the note failed. Say so plainly.
        setError(
          t({
            es: `Pago enviado (tx ${txHash}), pero no pudimos registrarlo. No lo envíes de nuevo; actualiza en un minuto.`,
            en: `Payment sent (tx ${txHash}), but we couldn’t record it. Don’t send again; refresh in a minute.`,
          }),
        );
      }
      router.refresh();
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function friendlyError(e: unknown, t: T): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user (rejected|denied)|rejected the request|cancel/i.test(msg)) return t({
      es: "Cancelaste el pago en tu billetera. No se envió nada.",
      en: "You cancelled the payment in your wallet. Nothing was sent.",
    });
  return msg.split("\n")[0];
}

function EvmPay({ chain, ...p }: WalletPayProps & { chain: UsdtChain }) {
  const t = useT();
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { busy, error, run } = usePayFlow(p, chain);
  const chainId = chain.chainId!;
  const token = chain.contract as `0x${string}`;

  async function pay() {
    if (!address) return;
    await run(
      address,
      async () => {
        await switchChain(config, { chainId });
        return readContract(config, { address: token, abi: erc20Abi, functionName: "balanceOf", args: [address], chainId });
      },
      (amount) =>
        writeContract(config, {
          address: token,
          abi: erc20Abi,
          functionName: "transfer",
          args: [p.depositAddress as `0x${string}`, amount],
          chainId,
        }),
    );
  }

  return (
    <Box>
      <p className="font-semibold">{t({ es: "O paga desde tu billetera", en: "Or pay from your wallet" })}</p>
      {isConnected && address ? (
        <>
          <p className="text-sm text-slate-600">
            {t({ es: "Conectada: ", en: "Connected: " })}
            <span className="font-mono">{shortAddress(address)}</span>{" "}
            <button type="button" className="underline" onClick={() => open()}>
              {t({ es: "cambiar", en: "change" })}
            </button>
          </p>
          <button type="button" className="btn-primary w-full" onClick={pay} disabled={busy}>
            {busy
              ? t({ es: "Revisa tu billetera…", en: "Check your wallet…" })
              : t({ es: `Pagar ${trimAmount(p.amount)} USDT en ${chain.label}`, en: `Pay ${trimAmount(p.amount)} USDT on ${chain.label}` })}
          </button>
        </>
      ) : (
        <button type="button" className="btn-secondary w-full" onClick={() => open()}>
          {t({ es: "Conectar billetera", en: "Connect wallet" })}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Box>
  );
}

function TronPay({ chain, ...p }: WalletPayProps & { chain: UsdtChain }) {
  const t = useT();
  const [address, setAddress] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const { busy, error, run } = usePayFlow(p, chain);

  async function connect() {
    setConnectError(null);
    try {
      setAddress(await connectTron());
    } catch (e) {
      setConnectError(friendlyError(e, t));
    }
  }

  return (
    <Box>
      <p className="font-semibold">{t({ es: "O paga desde tu billetera", en: "Or pay from your wallet" })}</p>
      {address ? (
        <>
          <p className="text-sm text-slate-600">
            {t({ es: "Conectada: ", en: "Connected: " })}
            <span className="font-mono">{shortAddress(address)}</span>
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={() =>
              run(
                address,
                () => tronUsdtBalance(chain.contract, address),
                (amount) => sendTronUsdt(chain.contract, p.depositAddress, amount),
              )
            }
          >
            {busy
              ? t({ es: "Revisa TronLink…", en: "Check TronLink…" })
              : t({ es: `Pagar ${trimAmount(p.amount)} USDT en Tron`, en: `Pay ${trimAmount(p.amount)} USDT on Tron` })}
          </button>
        </>
      ) : (
        <button type="button" className="btn-secondary w-full" onClick={connect}>
          {hasTronLink()
            ? t({ es: "Conectar TronLink", en: "Connect TronLink" })
            : t({ es: "Conectar TronLink (primero instálalo)", en: "Connect TronLink (install it first)" })}
        </button>
      )}
      {(connectError || error) && <p className="text-sm text-red-600">{connectError || error}</p>}
    </Box>
  );
}
