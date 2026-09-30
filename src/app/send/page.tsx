import { SendForm } from "./SendForm";
import { getT } from "@/lib/i18n/server";

export default async function SendPage() {
  const { t } = await getT();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t({ es: "Enviar dinero", en: "Send money" })}</h1>
      <SendForm />
    </div>
  );
}
