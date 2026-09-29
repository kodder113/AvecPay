import { Scanner } from "@/components/cobros/Scanner";

export default function EscanearPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pagar con QR</h1>
        <p className="text-slate-600">Escanea el QR del comercio o sube una captura que te enviaron.</p>
      </div>
      <Scanner />
    </div>
  );
}
