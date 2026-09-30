"use client";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n/LangProvider";

// Cobros pages have their own Demo / Dinero real label; the MoonPay banner
// would wrongly say "no real funds" on a real Zelle charge.
const COBROS = ["/cobrar", "/pagar", "/escanear", "/banco-demo"];

/** MoonPay sandbox notice, shown on the transfer (MoonPay) pages only. */
export function SandboxBanner() {
  const path = usePathname();
  const t = useT();
  if (COBROS.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <div className="bg-amber-100 px-4 py-1 text-center text-xs font-medium text-amber-900">
      {t({ es: "Modo sandbox: entorno de prueba de MoonPay. No se mueve dinero real.", en: "Sandbox mode — MoonPay test environment. No real funds move." })}
    </div>
  );
}
