import { Scanner } from "@/components/cobros/Scanner";
import { getT } from "@/lib/i18n/server";

export default async function EscanearPage() {
  const { t } = await getT();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t({ es: "Pagar con QR", en: "Pay with QR" })}</h1>
        <p className="text-slate-600">{t({ es: "Escanea el QR del comercio o sube una captura que te enviaron.", en: "Scan the merchant's QR or upload a screenshot someone sent you." })}</p>
      </div>
      <Scanner />
    </div>
  );
}
