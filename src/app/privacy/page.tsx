import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { LegalPage, supportContact } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Avec Pay" };

export default async function PrivacyPage() {
  const { t } = await getT();
  const contact = supportContact();
  const reach = contact ? t({ es: `Escríbenos a ${contact}.`, en: `Email us at ${contact}.` }) : t({ es: "Contáctanos desde tu cuenta de Avec Pay.", en: "Contact us from your Avec Pay account." });
  return (
    <LegalPage
      title={t({ es: "Política de privacidad", en: "Privacy Policy" })}
      updated={t({ es: "Última actualización: 1 de octubre de 2026", en: "Last updated: October 1, 2026" })}
      intro={t({
        es: "Esta política explica qué datos maneja Avec Pay, para qué y con quién los comparte.",
        en: "This policy explains what data Avec Pay handles, why, and who it's shared with.",
      })}
      back={t({ es: "Volver al inicio", en: "Back to home" })}
      sections={[
        {
          title: t({ es: "Datos que guardamos", en: "Data we keep" }),
          body: [
            t({
              es: "Del negocio: correo de acceso, nombre del negocio, ajustes, usuarios del equipo y sus roles, y los datos de pago que tú configuras (por ejemplo tu teléfono de Zelle o tu usuario de Venmo).",
              en: "About the business: sign-in email, business name, settings, team members and their roles, and the payment details you set up (for example your Zelle phone or Venmo username).",
            }),
            t({
              es: "De los cobros: monto, propina, estado, método, fecha, quién del equipo lo creó, y lo que escribas o dé el cliente (número de ticket, nombre y correo del cliente, nombre del pagador).",
              en: "About payments: amount, tip, status, method, date, which team member created it, and what you or the customer enter (ticket number, customer name and email, payer name).",
            }),
            t({
              es: "Técnicos: sesiones y tipo de dispositivo, y la ciudad aproximada según la conexión, para seguridad y para la regla de un dispositivo del plan Starter.",
              en: "Technical: sign-in sessions and device type, and approximate city from the connection, for security and the Starter plan's one-device rule.",
            }),
          ],
        },
        {
          title: t({ es: "Datos que no guardamos", en: "Data we don't keep" }),
          body: [
            t({
              es: "Nunca vemos ni guardamos números de tarjeta: los maneja Stripe. No tenemos acceso a tu banco ni a tus apps de pago.",
              en: "We never see or store card numbers: Stripe handles them. We have no access to your bank or payment apps.",
            }),
          ],
        },
        {
          title: t({ es: "Para qué los usamos", en: "How we use it" }),
          body: [
            t({
              es: "Para dar el servicio (crear cobros, confirmar pagos, reportes, recordatorios), cobrar tu plan, prevenir fraude y abuso, darte soporte y mejorar Avec. No vendemos datos personales.",
              en: "To provide the service (create charges, confirm payments, reports, reminders), bill your plan, prevent fraud and abuse, support you, and improve Avec. We don't sell personal data.",
            }),
          ],
        },
        {
          title: t({ es: "Con quién los compartimos", en: "Who we share it with" }),
          body: [
            t({
              es: "Proveedores que hacen funcionar Avec: Stripe (pagos y facturación), Supabase (base de datos y acceso), Vercel (hospedaje), Resend (correos) y Anthropic (reportes con IA: recibe totales de ventas y nombres del equipo, no datos de tarjeta). También podemos compartir datos si la ley lo exige.",
              en: "Providers that run Avec: Stripe (payments and billing), Supabase (database and sign-in), Vercel (hosting), Resend (email) and Anthropic (AI reports: it receives sales totals and team names, never card data). We may also share data when the law requires it.",
            }),
          ],
        },
        {
          title: t({ es: "Cuánto tiempo", en: "How long" }),
          body: [
            t({
              es: "Mientras tu cuenta esté activa y después el tiempo que exijan las leyes contables y fiscales. Puedes pedir que borremos tu cuenta.",
              en: "While your account is active, and afterwards for as long as accounting and tax laws require. You can ask us to delete your account.",
            }),
          ],
        },
        {
          title: t({ es: "Tus derechos", en: "Your rights" }),
          body: [
            t({
              es: "Puedes pedir una copia de tus datos, corregirlos o borrarlos. Los negocios del plan Business pueden exportar sus cobros en CSV en cualquier momento.",
              en: "You can ask for a copy of your data, correct it or delete it. Business plan accounts can export their payments as CSV at any time.",
            }),
          ],
        },
        {
          title: t({ es: "Contacto", en: "Contact" }),
          body: [reach],
        },
      ]}
    />
  );
}
