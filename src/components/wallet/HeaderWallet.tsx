"use client";
import { useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { WalletProvider, useEvmWalletEnabled } from "./WalletProvider";
import { connectTron, hasTronLink } from "@/lib/wallet/tron";
import { shortAddress } from "@/lib/chains";
import { useT } from "@/components/i18n/LangProvider";

/**
 * Top-bar wallet button. Connecting only shares the wallet's address with the
 * page; payments are always approved separately in the wallet itself.
 */
export default function HeaderWallet() {
  return (
    <WalletProvider>
      <Inner />
    </WalletProvider>
  );
}

function Inner() {
  return useEvmWalletEnabled() ? <WithEvm /> : <Panel evm={null} />;
}

interface EvmControls {
  address: string | null;
  connect: () => void;
  disconnect: () => void;
}

function WithEvm() {
  const { open } = useAppKit();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  return <Panel evm={{ address: address ?? null, connect: () => open(), disconnect: () => disconnect() }} />;
}

function Panel({ evm }: { evm: EvmControls | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [tron, setTron] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // TronLink remembers sites it already approved; pick that up on load.
  useEffect(() => {
    const a = window.tronWeb?.defaultAddress?.base58;
    if (a) setTron(a);
  }, []);

  const connected = evm?.address ?? tron;

  async function connectTronLink() {
    setError(null);
    try {
      setTron(await connectTron());
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold sm:px-3 ${
          connected ? "border border-white/25 text-white" : "bg-brand-yellow text-brand-ink"
        }`}
      >
        {connected ? (
          <span className="font-mono">{shortAddress(connected)}</span>
        ) : (
          <>
            <span className="sm:hidden">{t({ es: "Billetera", en: "Wallet" })}</span>
            <span className="hidden sm:inline">{t({ es: "Conectar billetera", en: "Connect wallet" })}</span>
          </>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label={t({ es: "Cerrar", en: "Close" })} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-xl">
            <p className="font-semibold">{t({ es: "Tu billetera", en: "Your wallet" })}</p>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ es: "Ethereum, Polygon y más", en: "Ethereum, Polygon & more" })}</p>
              {evm?.address ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{shortAddress(evm.address)}</span>
                  <button type="button" className="text-xs text-red-600 underline" onClick={evm.disconnect}>
                    {t({ es: "Desconectar", en: "Disconnect" })}
                  </button>
                </div>
              ) : evm ? (
                <button type="button" className="btn-secondary w-full py-2" onClick={() => { setOpen(false); evm.connect(); }}>
                  MetaMask, Trust, Coinbase…
                </button>
              ) : (
                <p className="text-xs text-slate-500">
                  {t({
                    es: "WalletConnect aún no está configurado (necesita el Project ID de Reown).",
                    en: "WalletConnect isn’t set up yet (needs the Reown Project ID).",
                  })}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tron</p>
              {tron ? (
                <span className="font-mono">{shortAddress(tron)}</span>
              ) : hasTronLink() ? (
                <button type="button" className="btn-secondary w-full py-2" onClick={connectTronLink}>
                  TronLink
                </button>
              ) : (
                <a className="text-xs text-brand-ink underline" href="https://www.tronlink.org/" target="_blank" rel="noreferrer">
                  {t({ es: "Instala TronLink para usar Tron", en: "Install TronLink to use Tron" })}
                </a>
              )}
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
            <p className="text-xs text-slate-500">
              {t({
                es: "Conectar solo comparte tu dirección. Cada pago se aprueba en tu billetera.",
                en: "Connecting only shares your address. Every payment is approved in your wallet.",
              })}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
