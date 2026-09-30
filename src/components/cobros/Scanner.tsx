"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { parseChargeCode } from "@/lib/cobros/parse";
import { useT } from "@/components/i18n/LangProvider";

/** Reads an Avec QR from the camera or from a screenshot, then opens the payment. */
export function Scanner() {
  const t = useT();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handle(text: string): boolean {
    const code = parseChargeCode(text);
    if (!code) {
      setMessage(t({ es: "Ese QR no es un cobro de Avec.", en: "That QR isn't an Avec charge." }));
      return false;
    }
    router.push(`/pagar/${code}`);
    return true;
  }

  function decode(source: CanvasImageSource, w: number, h: number): string | null {
    const canvas = canvasRef.current!;
    // Downscale big screenshots; QR codes don't need full resolution.
    const scale = Math.min(1, 1200 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height)?.data ?? null;
  }

  async function onFile(file: File) {
    setMessage(null);
    const bitmap = await createImageBitmap(file);
    const text = decode(bitmap, bitmap.width, bitmap.height);
    if (!text) return setMessage(t({ es: "No encontramos un QR en esa imagen. Intenta con una captura más clara.", en: "We couldn't find a QR in that image. Try a clearer screenshot." }));
    handle(text);
  }

  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const tick = () => {
          if (stopped) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const text = decode(video, video.videoWidth, video.videoHeight);
            if (text && handle(text)) return;
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setMessage(t({ es: "No pudimos abrir la cámara. Sube una captura del QR en su lugar.", en: "We couldn't open the camera. Upload a screenshot of the QR instead." }));
        setCamera(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  return (
    <div className="space-y-4">
      {camera ? (
        <div className="overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
        </div>
      ) : (
        <button type="button" className="btn-primary w-full py-4 text-base" onClick={() => setCamera(true)}>
          📷 {t({ es: "Escanear con la cámara", en: "Scan with the camera" })}
        </button>
      )}
      {camera && (
        <button type="button" className="btn-secondary w-full" onClick={() => setCamera(false)}>
          {t({ es: "Cerrar cámara", en: "Close camera" })}
        </button>
      )}
      <label className="btn-secondary w-full cursor-pointer py-4 text-base">
        🖼️ {t({ es: "Subir captura del QR", en: "Upload a QR screenshot" })}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {message && <p className="card text-sm text-slate-700">{message}</p>}
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-center text-xs text-slate-500">
        {t({
          es: "También puedes escanear el QR con la cámara normal de tu teléfono: abre el enlace de pago directamente.",
          en: "You can also scan the QR with your phone's regular camera: it opens the payment link directly.",
        })}
      </p>
    </div>
  );
}
