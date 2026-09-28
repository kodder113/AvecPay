import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";

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
        {sandbox && (
          <div className="bg-amber-100 px-4 py-1 text-center text-xs font-medium text-amber-900">
            Sandbox mode — MoonPay test environment. No real funds move.
          </div>
        )}
        <header className="bg-brand-ink">
          <nav className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <Link href={user ? "/dashboard" : "/"} aria-label="Avec Pay home">
              <Logo />
            </Link>
            {user ? (
              <div className="flex items-center gap-3 text-sm">
                <Link href="/send" className="font-medium text-slate-200 hover:text-brand-yellow">
                  Send
                </Link>
                <Link href="/recipients" className="font-medium text-slate-200 hover:text-brand-yellow">
                  Recipients
                </Link>
                <form action="/auth/signout" method="post">
                  <button className="text-slate-400 hover:text-white">Sign out</button>
                </form>
              </div>
            ) : (
              <Link href="/login" className="text-sm font-semibold text-brand-yellow">
                Sign in
              </Link>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
