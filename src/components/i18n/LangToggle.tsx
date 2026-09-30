"use client";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, LANGS, type Lang } from "@/lib/i18n";
import { useLang } from "./LangProvider";

/** EN | ES switch in the top bar. Saved on this device for a year. */
export function LangToggle() {
  const lang = useLang();
  const router = useRouter();

  function choose(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-white/25 text-xs font-bold" role="group" aria-label="Language / Idioma">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={l === lang}
          className={`px-1.5 py-1 uppercase sm:px-2 sm:py-1.5 ${l === lang ? "bg-brand-yellow text-brand-ink" : "text-slate-300 hover:text-white"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
