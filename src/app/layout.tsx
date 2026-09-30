import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SandboxBanner } from "@/components/SandboxBanner";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { HeaderWallet } from "@/components/wallet";

export const metadata: Metadata = {
  title: "Avec Pay",
  description: "Send USDT, your recipient gets paid in local fiat via regulated off-ramp partners.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1B1E25" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sandbox = process.env.MOONPAY_ENV !== "production";

  return (
    <html lang="en">
      <body>
        {sandbox && <SandboxBanner />}
        <header className="bg-brand-ink">
          <nav className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <Link href={user ? "/dashboard" : "/"} aria-label="Avec Pay home">
              <Logo />
            </Link>
            {user ? (
              <HeaderWallet />
            ) : (
              <Link href="/login" className="text-sm font-semibold text-brand-yellow">
                Sign in
              </Link>
            )}
          </nav>
          {user && (
            <div className="mx-auto flex max-w-3xl items-center gap-5 overflow-x-auto whitespace-nowrap px-4 pb-3 text-sm font-medium">
              <Link href="/cobrar" className="font-semibold text-brand-yellow">
                Cobrar
              </Link>
              <Link href="/escanear" className="text-slate-200 hover:text-brand-yellow">
                Pagar QR
              </Link>
              <Link href="/banco-demo" className="text-slate-200 hover:text-brand-yellow">
                Banco Demo
              </Link>
              <span className="h-4 w-px bg-white/20" />
              <Link href="/dashboard" className="text-slate-200 hover:text-brand-yellow">
                Transfers
              </Link>
              <Link href="/send" className="text-slate-200 hover:text-brand-yellow">
                Send
              </Link>
              <Link href="/recipients" className="text-slate-200 hover:text-brand-yellow">
                Recipients
              </Link>
              <form action="/auth/signout" method="post" className="ml-auto pl-2">
                <button className="text-slate-400 hover:text-white">Sign out</button>
              </form>
            </div>
          )}
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
