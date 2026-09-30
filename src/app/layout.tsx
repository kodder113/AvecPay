import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SandboxBanner } from "@/components/SandboxBanner";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { HeaderWallet } from "@/components/wallet";
import { getT } from "@/lib/i18n/server";
import { LangProvider } from "@/components/i18n/LangProvider";
import { LangToggle } from "@/components/i18n/LangToggle";

export const metadata: Metadata = {
  title: "Avec Pay",
  description:
    "Send USDT, your recipient gets paid in local fiat via regulated off-ramp partners.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B1E25",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sandbox = process.env.MOONPAY_ENV !== "production";
  const { lang, t } = await getT();

  return (
    <html lang={lang}>
      <body>
        <LangProvider lang={lang}>
          {sandbox && <SandboxBanner />}
          <header className="bg-brand-ink">
            <nav className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
              <Link href={user ? "/dashboard" : "/"} aria-label="Avec Pay home">
                <Logo size={28} />
              </Link>
              <div className="flex items-center gap-2">
                <LangToggle />
                {user ? (
                  <HeaderWallet />
                ) : (
                  <Link
                    href="/login"
                    className="text-sm font-semibold text-brand-yellow"
                  >
                    {t({ es: "Entrar", en: "Sign in" })}
                  </Link>
                )}
              </div>
            </nav>
            {user && (
              <div className="mx-auto flex max-w-3xl items-center gap-5 overflow-x-auto whitespace-nowrap px-4 pb-3 text-sm font-medium">
                <Link
                  href="/cobrar"
                  className="font-semibold text-brand-yellow"
                >
                  {t({ es: "Cobrar", en: "Charge" })}
                </Link>
                <Link
                  href="/escanear"
                  className="text-slate-200 hover:text-brand-yellow"
                >
                  {t({ es: "Pagar QR", en: "Pay QR" })}
                </Link>
                <Link
                  href="/banco-demo"
                  className="text-slate-200 hover:text-brand-yellow"
                >
                  {t({ es: "Banco Demo", en: "Demo Bank" })}
                </Link>
                <span className="h-4 w-px bg-white/20" />
                <Link
                  href="/dashboard"
                  className="text-slate-200 hover:text-brand-yellow"
                >
                  {t({ es: "Envíos", en: "Transfers" })}
                </Link>
                <Link
                  href="/send"
                  className="text-slate-200 hover:text-brand-yellow"
                >
                  {t({ es: "Enviar", en: "Send" })}
                </Link>
                <Link
                  href="/recipients"
                  className="text-slate-200 hover:text-brand-yellow"
                >
                  {t({ es: "Destinatarios", en: "Recipients" })}
                </Link>
                <form
                  action="/auth/signout"
                  method="post"
                  className="ml-auto pl-2"
                >
                  <button className="text-slate-400 hover:text-white">
                    {t({ es: "Salir", en: "Sign out" })}
                  </button>
                </form>
              </div>
            )}
          </header>
          <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
        </LangProvider>
      </body>
    </html>
  );
}
