"use client";
import dynamic from "next/dynamic";

// Wallet libraries only run in the browser; load them client-side so server
// and client renders always match.
export const WalletPayCard = dynamic(() => import("./WalletPayCard"), { ssr: false });
export const UseMyWalletButton = dynamic(() => import("./UseMyWalletButton"), { ssr: false });
