"use client";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { WalletProvider, useEvmWalletEnabled } from "./WalletProvider";
import { connectTron, hasTronLink } from "@/lib/wallet/tron";
import { usdtChainForNetwork } from "@/lib/chains";

interface Props {
  network: string | null;
  onAddress: (address: string) => void;
}

/** Fills the refund address from the sender's connected wallet. */
export default function UseMyWalletButton(props: Props) {
  return (
    <WalletProvider>
      <Inner {...props} />
    </WalletProvider>
  );
}

function Inner({ network, onAddress }: Props) {
  const evmEnabled = useEvmWalletEnabled();
  const chain = usdtChainForNetwork(network);
  if (!chain) return null;
  if (chain.kind === "tron") return <TronButton onAddress={onAddress} />;
  return evmEnabled ? <EvmButton onAddress={onAddress} /> : null;
}

function EvmButton({ onAddress }: { onAddress: (a: string) => void }) {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const [waiting, setWaiting] = useState(false);

  // After the connect modal, fill in the address once the wallet connects.
  useEffect(() => {
    if (waiting && address) {
      onAddress(address);
      setWaiting(false);
    }
  }, [waiting, address, onAddress]);

  return (
    <button
      type="button"
      className="btn-secondary px-3 py-2"
      onClick={() => {
        if (isConnected && address) onAddress(address);
        else {
          setWaiting(true);
          open();
        }
      }}
    >
      Use my wallet
    </button>
  );
}

function TronButton({ onAddress }: { onAddress: (a: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  if (!hasTronLink()) return null;
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        className="btn-secondary px-3 py-2"
        onClick={async () => {
          setError(null);
          try {
            onAddress(await connectTron());
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        Use TronLink
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
