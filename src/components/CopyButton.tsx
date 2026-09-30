"use client";
import { useState } from "react";
import { useT } from "@/components/i18n/LangProvider";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary px-3 py-2"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? t({ es: "Copiado", en: "Copied" }) : (label ?? t({ es: "Copiar", en: "Copy" }))}
    </button>
  );
}
