"use client";
import { createContext, useContext, useState } from "react";
import { WagmiProvider, type Config } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { arbitrum, avalanche, bsc, mainnet, optimism, polygon, type AppKitNetwork } from "@reown/appkit/networks";

/**
 * WalletConnect (Reown AppKit) for Ethereum-style networks. It is only set up
 * when NEXT_PUBLIC_REOWN_PROJECT_ID is configured; without it, EVM wallet
 * buttons are hidden and copy-paste still works. Tron uses TronLink directly.
 */
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

let wagmiConfig: Config | null = null;
if (projectId && typeof window !== "undefined") {
  const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, polygon, arbitrum, optimism, bsc, avalanche];
  const adapter = new WagmiAdapter({ networks, projectId, ssr: true });
  createAppKit({
    adapters: [adapter],
    networks,
    projectId,
    metadata: {
      name: "Avec Pay",
      description: "Send USDT. They receive local money.",
      url: window.location.origin,
      icons: [`${window.location.origin}/brand/avecpay-mark.png`],
    },
    features: { analytics: false, email: false, socials: false },
    themeMode: "light",
    themeVariables: { "--w3m-accent": "#1B1E25" },
  });
  wagmiConfig = adapter.wagmiConfig;
}

const EvmEnabled = createContext(false);
export const useEvmWalletEnabled = () => useContext(EvmEnabled);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  if (!wagmiConfig) return <EvmEnabled.Provider value={false}>{children}</EvmEnabled.Provider>;
  return (
    <EvmEnabled.Provider value={true}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    </EvmEnabled.Provider>
  );
}
