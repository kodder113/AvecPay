"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoFull } from "@/components/Logo";

/** Only same-site paths, so the sign-in can't bounce people to another site. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

function friendlyError(message: string): string {
  if (/rate limit/i.test(message)) return "Demasiados intentos. Espera un minuto e intenta de nuevo. · Too many attempts, wait a minute.";
  if (/expired|invalid/i.test(message)) return "Código incorrecto o vencido. Revisa el correo o pide uno nuevo. · Wrong or expired code.";
  return message;
}

/**
 * Email + one-time code, entered in the same browser. Email links open in
 * whatever browser the mail app picks (e.g. Gmail → Chrome on iPhone), which
 * breaks the sign-in started in Safari; a typed code never leaves the page.
 */
function LoginForm() {
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
    if (error) return setError(friendlyError(error.message));
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
      return setError(friendlyError(error.message));
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
          <h1 className="text-xl font-semibold">Revisa tu correo</h1>
          <p className="text-sm text-slate-500">Check your email</p>
        </div>
        <p className="text-slate-600">
          Enviamos un código a <b className="break-words">{email}</b>. Escríbelo aquí.
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
          aria-label="Código de 6 dígitos"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full py-4 text-base" disabled={busy || code.length < 6}>
          {busy ? "Verificando…" : "Entrar · Sign in"}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="text-slate-500 underline" onClick={() => setStep("email")}>
            Cambiar correo
          </button>
          <button type="button" className="text-brand-ink underline disabled:no-underline disabled:opacity-50" disabled={cooldown > 0 || busy} onClick={() => sendCode()}>
            {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
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
        <h1 className="text-xl font-semibold">Entra o crea tu cuenta</h1>
        <p className="text-sm text-slate-500">
          Sign in or create your <span className="whitespace-nowrap">Avec Pay</span> account
        </p>
      </div>
      <div>
        <label className="label" htmlFor="email">Correo · Email</label>
        <input id="email" type="email" inputMode="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full py-4 text-base" disabled={busy}>
        {busy ? "Enviando…" : "Enviar código · Send code"}
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
