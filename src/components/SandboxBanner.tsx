"use client";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n/LangProvider";

// Only the USDT transfer pages run on MoonPay; everywhere else (Cobros,
// landing, plans) the banner would wrongly say "no real funds move".
const MOONPAY = ["/dashboard", "/send", "/recipients", "/transfers", "/r"];

/** MoonPay sandbox notice, shown on the transfer (MoonPay) pages only. */
export function SandboxBanner() {
  const path = usePathname();
  const t = useT();
  if (!MOONPAY.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <div className="bg-amber-100 px-4 py-1 text-center text-xs font-medium text-amber-900 print:hidden">
      {t({ es: "Modo sandbox: entorno de prueba de MoonPay. No se mueve dinero real.", en: "Sandbox mode — MoonPay test environment. No real funds move." })}
    </div>
  );
}
