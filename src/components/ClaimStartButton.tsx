"use client";
import { useState } from "react";

export function ClaimStartButton({ token, providerName }: { token: string; providerName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/claim/${token}/start`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      setBusy(false);
      setError(body.error ?? "Could not start. Please try again.");
      return;
    }
    window.location.href = body.url;
  }

  return (
    <div className="space-y-2">
      <button className="btn-primary w-full" onClick={start} disabled={busy}>
        {busy ? "Opening…" : `Continue with ${providerName}`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
