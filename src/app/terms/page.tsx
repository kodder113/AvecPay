import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { LegalPage, supportContact } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · Avec Pay" };

export default async function TermsPage() {
  const { t } = await getT();
  const contact = supportContact();
  const reach = contact ? t({ es: `Escríbenos a ${contact}.`, en: `Email us at ${contact}.` }) : t({ es: "Contáctanos desde tu cuenta de Avec Pay.", en: "Contact us from your Avec Pay account." });
  return (
    <LegalPage
      title={t({ es: "Términos de servicio", en: "Terms of Service" })}
      updated={t({ es: "Última actualización: 1 de octubre de 2026", en: "Last updated: October 1, 2026" })}
      intro={t({
        es: "Estos términos rigen el uso de Avec Pay por negocios (“tú”). Al crear una cuenta o usar Avec Pay, los aceptas.",
        en: "These terms govern the use of Avec Pay by businesses (“you”). By creating an account or using Avec Pay, you agree to them.",
      })}
      back={t({ es: "Volver al inicio", en: "Back to home" })}
      sections={[
        {
          title: t({ es: "Qué es Avec Pay", en: "What Avec Pay is" }),
          body: [
            t({
              es: "Avec Pay es software para generar códigos QR y enlaces de pago, registrar cobros y ver reportes. Avec Pay no es un banco, no es un transmisor de dinero y nunca recibe ni retiene el dinero de tus clientes.",
              en: "Avec Pay is software to create payment QR codes and links, record payments, and see reports. Avec Pay is not a bank, is not a money transmitter, and never receives or holds your customers' money.",
            }),
            t({
              es: "Los pagos con tarjeta, Apple Pay y Google Pay los procesa Stripe en tu propia cuenta de Stripe, bajo los términos de Stripe. Los pagos por Zelle, Venmo, Cash App o PayPal van directamente de la app del cliente a la tuya, bajo los términos de esos servicios. Tú eres el comerciante en cada venta.",
              en: "Card, Apple Pay and Google Pay payments are processed by Stripe on your own Stripe account, under Stripe's terms. Zelle, Venmo, Cash App and PayPal payments go directly from the customer's app to yours, under those services' terms. You are the merchant of record for every sale.",
            }),
          ],
        },
        {
          title: t({ es: "Tu cuenta y tu equipo", en: "Your account and your team" }),
          body: [
            t({
              es: "Debes dar información verdadera y mantener seguro el acceso. Eres responsable de lo que hagan los usuarios que invites. Cada plan incluye un número de usuarios (Starter 1, Team 5, Business 15). En Starter, la cuenta es para una persona y puede estar abierta en un solo dispositivo a la vez; compartirla no está permitido.",
              en: "You must provide accurate information and keep access secure. You're responsible for what the users you invite do. Each plan includes a number of users (Starter 1, Team 5, Business 15). On Starter, the account is for one person and can be signed in on one device at a time; sharing it isn't allowed.",
            }),
          ],
        },
        {
          title: t({ es: "Planes, pagos y cancelación", en: "Plans, billing and cancellation" }),
          body: [
            t({
              es: "Los planes se cobran por mes, por adelantado, y se renuevan automáticamente hasta que canceles. Puedes cancelar en cualquier momento; el plan sigue activo hasta el final del mes pagado y no se reembolsan meses parciales. Si un pago falla, tienes 7 días para actualizar tu tarjeta antes de que se pause la cuenta.",
              en: "Plans are billed monthly in advance and renew automatically until you cancel. You can cancel anytime; the plan stays active until the end of the paid month and partial months aren't refunded. If a payment fails, you have 7 days to update your card before the account is paused.",
            }),
            t({
              es: "El precio de lanzamiento se mantiene mientras tu suscripción siga activa sin interrupción. Los códigos de activación, prueba o descuento aplican según sus condiciones y no tienen valor en efectivo.",
              en: "Launch pricing is kept for as long as your subscription stays active without interruption. Activation, trial and discount codes apply under their stated conditions and have no cash value.",
            }),
          ],
        },
        {
          title: t({ es: "Comisión de Avec", en: "Avec's fee" }),
          body: [
            t({
              es: "En los pagos procesados por Stripe, Avec cobra una comisión de 0.5% del monto (nunca sobre propinas), que Stripe descuenta automáticamente, además de las tarifas propias de Stripe. Te avisaremos con al menos 30 días de anticipación si cambia.",
              en: "On payments processed through Stripe, Avec charges a 0.5% fee on the amount (never on tips), which Stripe deducts automatically, in addition to Stripe's own fees. We'll give you at least 30 days' notice before it changes.",
            }),
          ],
        },
        {
          title: t({ es: "Tus responsabilidades", en: "Your responsibilities" }),
          body: [
            t({
              es: "Vendes productos y servicios legales y cumples las leyes que te aplican, incluidos los impuestos. Manejas reembolsos, reclamos y contracargos con tus clientes y con Stripe.",
              en: "You sell lawful goods and services and follow the laws that apply to you, including taxes. You handle refunds, complaints and chargebacks with your customers and with Stripe.",
            }),
            t({
              es: "Avec no puede ver tu banco ni tus apps de pago. Cuando un cliente dice que pagó por Zelle, Venmo, Cash App o PayPal, confirma que el dinero llegó antes de entregar; marcar “Recibido” es tu decisión.",
              en: "Avec can't see your bank or payment apps. When a customer says they paid by Zelle, Venmo, Cash App or PayPal, confirm the money arrived before handing anything over; marking “Received” is your decision.",
            }),
            t({
              es: "Solo envías recordatorios a clientes que te dieron su correo para esa venta.",
              en: "You only send reminders to customers who gave you their email for that sale.",
            }),
          ],
        },
        {
          title: t({ es: "Reportes con IA", en: "AI reports" }),
          body: [
            t({
              es: "Los reportes y respuestas con IA se basan en tus datos de ventas en Avec y son solo informativos. Pueden contener errores; revisa las cifras importantes en tu historial antes de decidir.",
              en: "AI reports and answers are based on your sales data in Avec and are for information only. They can contain mistakes; check important figures in your history before making decisions.",
            }),
          ],
        },
        {
          title: t({ es: "Uso aceptable", en: "Acceptable use" }),
          body: [
            t({
              es: "No uses Avec para fraude, para cobrar a nombre de otra persona, para evadir las reglas de Stripe o de otros servicios, ni para intentar acceder a datos de otros negocios. Podemos suspender cuentas que lo hagan.",
              en: "Don't use Avec for fraud, to collect money in someone else's name, to get around Stripe's or other services' rules, or to try to access other businesses' data. We may suspend accounts that do.",
            }),
          ],
        },
        {
          title: t({ es: "Disponibilidad y cambios", en: "Availability and changes" }),
          body: [
            t({
              es: "Trabajamos para que Avec esté disponible, pero puede haber interrupciones. Podemos mejorar o cambiar funciones; si un cambio te afecta de forma importante, te avisaremos. Podemos actualizar estos términos y publicaremos la fecha de la nueva versión.",
              en: "We work to keep Avec available, but there may be interruptions. We may improve or change features; if a change significantly affects you, we'll let you know. We may update these terms and will post the date of the new version.",
            }),
          ],
        },
        {
          title: t({ es: "Garantías y responsabilidad", en: "Warranties and liability" }),
          body: [
            t({
              es: "Avec se ofrece “tal cual”. En la medida que la ley lo permita, no somos responsables por pérdidas indirectas ni por pagos que dependen de terceros (Stripe, bancos o apps de pago), y nuestra responsabilidad total se limita a lo que pagaste por Avec en los 12 meses anteriores.",
              en: "Avec is provided “as is”. To the extent the law allows, we aren't liable for indirect losses or for payments that depend on third parties (Stripe, banks or payment apps), and our total liability is limited to what you paid for Avec in the previous 12 months.",
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
