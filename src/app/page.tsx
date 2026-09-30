import Link from "next/link";
import { LogoFull } from "@/components/Logo";
import { getT } from "@/lib/i18n/server";

export default async function Home() {
  const { t } = await getT();
  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-2xl bg-brand-ink p-6 text-center text-white sm:p-10">
        <div className="flex justify-center">
          <LogoFull size={140} />
        </div>
        <h1 className="text-2xl font-black italic sm:text-3xl">
          {t({ es: "Envía USDT. Ellos reciben dinero local.", en: "Send USDT. They receive local money." })}
        </h1>
        <p className="text-slate-300">
          {t({
            es: "Envías USDT desde tu propia billetera. Tu destinatario se verifica con nuestro socio regulado de off-ramp (MoonPay), agrega una tarjeta de débito Visa elegible donde esté disponible y recibe dinero fiat.",
            en: "You send USDT from your own wallet. Your recipient verifies with our regulated off-ramp partner (MoonPay), adds an eligible Visa debit card where supported, and receives fiat.",
          })}
        </p>
        <Link href="/login" className="btn-primary w-full sm:w-auto sm:px-8">
          {t({ es: "Comenzar", en: "Get started" })}
        </Link>
      </section>
      <section className="card text-sm text-slate-600">
        <h2 className="mb-2 font-semibold text-slate-900">{t({ es: "Cómo funciona Avec Pay", en: "How Avec Pay works" })}</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            {t({
              es: "Ingresas el destinatario y el monto, y ves una cotización en vivo del socio de pago.",
              en: "You enter the recipient and amount, and see a live quote from the payout partner.",
            })}
          </li>
          <li>
            {t({
              es: "Tu destinatario abre su enlace, completa la verificación de identidad y elige una tarjeta para recibir el pago.",
              en: "Your recipient opens their link, completes identity verification and chooses a payout card.",
            })}
          </li>
          <li>
            {t({
              es: "El socio genera una dirección de depósito de un solo uso para esa orden. Tú envías a ella el monto exacto de USDT.",
              en: "The partner issues a one-time deposit address for that order. You send the exact USDT to it.",
            })}
          </li>
          <li>
            {t({
              es: "El socio convierte y paga. Tú sigues cada paso aquí.",
              en: "The partner converts and pays out. You track every step here.",
            })}
          </li>
        </ol>
        <p className="mt-3">
          {t({
            es: "Avec Pay nunca retiene tus fondos y nunca convierte cripto por su cuenta.",
            en: "Avec Pay never holds your funds and never converts crypto itself.",
          })}
        </p>
      </section>
    </div>
  );
}
