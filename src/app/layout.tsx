import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SandboxBanner } from "@/components/SandboxBanner";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/Logo";
import { HeaderWallet } from "@/components/wallet";
import { getT } from "@/lib/i18n/server";
import { LangProvider } from "@/components/i18n/LangProvider";
import { LangToggle } from "@/components/i18n/LangToggle";
import { MainNav, type NavItem } from "@/components/business/MainNav";
import { isAdmin } from "@/lib/business/admin";

export const metadata: Metadata = {
  title: "Avec Pay",
  description: "Get paid by QR: card, Apple Pay, Google Pay, Zelle, Venmo and Cash App, straight to your account.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B1E25",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sandbox = process.env.MOONPAY_ENV !== "production";
  const { lang, t } = await getT();

  let items: NavItem[] = [];
  if (user) {
    const admin = createAdminClient();
    const { data: member } = await admin.from("merchant_members").select("role").eq("user_id", user.id).eq("status", "active").maybeSingle();
    // First sign-in of an invited team member: the page accepts the invite in the same request.
    const { data: invite } =
      member || !user.email ? { data: null } : await admin.from("merchant_members").select("role").eq("email", user.email.toLowerCase()).eq("status", "invited").limit(1).maybeSingle();
    const role = (member?.role ?? invite?.role) as string | undefined;
    const lead = role === "owner" || role === "manager";
    items = [
      { href: "/cobrar", label: t({ es: "Cobrar", en: "Charge" }) },
      ...(role ? [{ href: "/cobrar/panel", label: t({ es: "Panel", en: "Dashboard" }) }] : []),
      ...(role ? [{ href: "/cobrar/historial", label: t({ es: "Historial", en: "History" }) }] : []),
      ...(role ? [{ href: "/cobrar/qr", label: t({ es: "Mis QR", en: "QR codes" }) }] : []),
      ...(lead ? [{ href: "/cobrar/equipo", label: t({ es: "Equipo", en: "Team" }) }] : []),
      ...(role === "owner" ? [{ href: "/cobrar/plan", label: t({ es: "Plan", en: "Plan" }) }] : []),
      ...(role === "owner" ? [{ href: "/cobrar/ajustes", label: t({ es: "Ajustes", en: "Settings" }) }] : []),
      { href: "/escanear", label: t({ es: "Pagar QR", en: "Pay a QR" }), divider: true },
      { href: "/banco-demo", label: t({ es: "Banco Demo", en: "Demo Bank" }) },
      { href: "/dashboard", label: "USDT", divider: true },
      ...(isAdmin(user.email) ? [{ href: "/admin", label: "Admin" }] : []),
    ];
  }

  return (
    <html lang={lang}>
      <body>
        <LangProvider lang={lang}>
          {sandbox && <SandboxBanner />}
          <header className="bg-brand-ink print:hidden">
            <nav className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
              <Link href={user ? "/cobrar" : "/"} aria-label="Avec Pay home">
                <Logo size={28} />
              </Link>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <LangToggle />
                {user ? (
                  <HeaderWallet />
                ) : (
                  <Link href="/login" className="text-sm font-semibold text-brand-yellow">
                    {t({ es: "Entrar", en: "Sign in" })}
                  </Link>
                )}
              </div>
            </nav>
            {user && <MainNav items={items} signOut={t({ es: "Salir", en: "Sign out" })} />}
          </header>
          <main className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
        </LangProvider>
      </body>
    </html>
  );
}
