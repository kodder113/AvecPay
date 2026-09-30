"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoFull } from "@/components/Logo";
import { useT } from "@/components/i18n/LangProvider";
import type { T } from "@/lib/i18n";

/** Only same-site paths, so the sign-in can't bounce people to another site. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/cobrar";
}

function friendlyError(message: string, t: T): string {
  if (/rate limit/i.test(message))
    return t({ es: "Demasiados intentos. Espera un minuto e intenta de nuevo.", en: "Too many attempts, wait a minute." });
  if (/expired|invalid/i.test(message))
    return t({ es: "Código incorrecto o vencido. Revisa el correo o pide uno nuevo.", en: "Wrong or expired code." });
  return message;
}

/**
 * Email + one-time code, entered in the same browser. Email links open in
 * whatever browser the mail app picks (e.g. Gmail → Chrome on iPhone), which
 * breaks the sign-in started in Safari; a typed code never leaves the page.
 */
function LoginForm() {
  const t = useT();
  const next = safeNext(useSearchParams().get("next"));
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      // The email may also contain a link; it still works on this same browser.
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) return setError(friendlyError(error.message, t));
    setStep("code");
    setCode("");
    setCooldown(60);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    if (error) {
      setBusy(false);
      return setError(friendlyError(error.message, t));
    }
    // Full navigation so the server sees the new session cookie.
    window.location.assign(next);
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="card space-y-4">
        <div className="flex justify-center">
          <LogoFull size={80} />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t({ es: "Revisa tu correo", en: "Check your email" })}</h1>
        </div>
        <p className="text-slate-600">
          {t({ es: "Enviamos un código a ", en: "We sent a code to " })}
          <b className="break-words">{email}</b>
          {t({ es: ". Escríbelo aquí.", en: ". Enter it here." })}
        </p>
        <input
          className="input text-center font-mono text-3xl tracking-[0.4em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="••••••"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          aria-label={t({ es: "Código de 6 dígitos", en: "6-digit code" })}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full py-4 text-base" disabled={busy || code.length < 6}>
          {busy ? t({ es: "Verificando…", en: "Verifying…" }) : t({ es: "Entrar", en: "Sign in" })}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="text-slate-500 underline" onClick={() => setStep("email")}>
            {t({ es: "Cambiar correo", en: "Change email" })}
          </button>
          <button type="button" className="text-brand-ink underline disabled:no-underline disabled:opacity-50" disabled={cooldown > 0 || busy} onClick={() => sendCode()}>
            {cooldown > 0
              ? t({ es: `Reenviar en ${cooldown}s`, en: `Resend in ${cooldown}s` })
              : t({ es: "Reenviar código", en: "Resend code" })}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="card space-y-4">
      <div className="flex justify-center">
        <LogoFull size={96} />
      </div>
      <div>
        <h1 className="text-xl font-semibold">{t({ es: "Entra o crea tu cuenta", en: "Sign in or create your account" })}</h1>
        <p className="text-sm text-slate-500">
          {t({ es: "Tu cuenta de ", en: "Your " })}
          <span className="whitespace-nowrap">Avec Pay</span>
          {t({ es: "", en: " account" })}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="email">{t({ es: "Correo", en: "Email" })}</label>
        <input id="email" type="email" inputMode="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full py-4 text-base" disabled={busy}>
        {busy ? t({ es: "Enviando…", en: "Sending…" }) : t({ es: "Enviar código", en: "Send code" })}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
