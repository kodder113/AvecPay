"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CorridorCapabilities, Quote } from "@/lib/providers/types";
import { QuoteBreakdown } from "@/components/QuoteBreakdown";
import { networkLabel } from "@/lib/format";

interface Recipient {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  country_code: string;
}

interface Country {
  code: string;
  name: string;
}

export function SendForm() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [recipientId, setRecipientId] = useState<string>("new");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");

  const [corridor, setCorridor] = useState<CorridorCapabilities | null>(null);
  const [corridorLoading, setCorridorLoading] = useState(false);
  const [assetCode, setAssetCode] = useState("");
  const [amount, setAmount] = useState("10");
  const [fiat, setFiat] = useState("");
  const [refundAddress, setRefundAddress] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/recipients"), fetch("/api/countries")])
      .then(async ([r, c]) => {
        if (r.ok) setRecipients(await r.json());
        if (c.ok) setCountries(await c.json());
        else setLoadError((await c.json().catch(() => ({}))).error ?? "Could not load supported countries");
      })
      .catch(() => setLoadError("Could not load data"));
  }, []);

  const selectedRecipient = recipients.find((r) => r.id === recipientId);
  const effectiveCountry = selectedRecipient?.country_code ?? country;

  // Load live capabilities whenever the destination country changes.
  useEffect(() => {
    setCorridor(null);
    setAssetCode("");
    setFiat("");
    setQuote(null);
    if (!effectiveCountry) return;
    setCorridorLoading(true);
    fetch(`/api/corridor?country=${effectiveCountry}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load corridor");
        setCorridor(body);
        if (body.assets.length === 1) setAssetCode(body.assets[0].code);
      })
      .catch((e) => setProblems([e.message]))
      .finally(() => setCorridorLoading(false));
  }, [effectiveCountry]);

  // Any input change invalidates the quote.
  useEffect(() => {
    setQuote(null);
    setProblems([]);
  }, [assetCode, amount, fiat, effectiveCountry]);

  const asset = useMemo(() => corridor?.assets.find((a) => a.code === assetCode) ?? null, [corridor, assetCode]);

  async function getQuote() {
    setBusy(true);
    setProblems([]);
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode: effectiveCountry, assetCode, amount, fiatCurrency: fiat }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setProblems(Array.isArray(body.details) ? body.details.map(String) : [body.error]);
    setQuote(body);
  }

  async function createTransfer() {
    setBusy(true);
    setProblems([]);
    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countryCode: effectiveCountry,
        assetCode,
        amount,
        fiatCurrency: fiat,
        refundWalletAddress: refundAddress,
        ...(selectedRecipient
          ? { recipientId: selectedRecipient.id }
          : { recipient: { fullName, email, phone, countryCode: country } }),
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setBusy(false);
      const details = Array.isArray(body.details)
        ? body.details.map((d: unknown) => (typeof d === "string" ? d : ((d as { message?: string }).message ?? JSON.stringify(d))))
        : [];
      return setProblems([body.error, ...details]);
    }
    router.push(`/transfers/${body.id}?new=1`);
  }

  const recipientReady = selectedRecipient || (fullName.trim() && (email.trim() || phone.trim()) && country);
  const canQuote = Boolean(recipientReady && corridor && !corridor.blockers.length && assetCode && fiat && Number(amount) > 0);

  return (
    <div className="space-y-4">
      {loadError && <p className="card text-sm text-red-600">{loadError}</p>}

      <section className="card space-y-4">
        <h2 className="font-semibold">Recipient</h2>
        {recipients.length > 0 && (
          <div>
            <label className="label" htmlFor="recipient">Send to</label>
            <select id="recipient" className="input" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
              <option value="new">New recipient…</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name} ({r.country_code})
                </option>
              ))}
            </select>
          </div>
        )}
        {!selectedRecipient && (
          <>
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="phone">Phone</label>
                <input id="phone" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+504 …" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="country">Country</label>
              <select id="country" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Select country…</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Only countries where MoonPay reports that off-ramp payouts are allowed.</p>
            </div>
          </>
        )}
      </section>

      {effectiveCountry && (
        <section className="card space-y-4">
          <h2 className="font-semibold">Amount</h2>
          {corridorLoading && <p className="text-sm text-slate-500">Checking what MoonPay supports for this country…</p>}
          {corridor?.blockers.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
              {corridor.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
          {corridor && !corridor.blockers.length && (
            <>
              <div>
                <label className="label" htmlFor="asset">Cryptocurrency</label>
                <select id="asset" className="input" value={assetCode} onChange={(e) => setAssetCode(e.target.value)}>
                  <option value="">Select USDT network…</option>
                  {corridor.assets.map((a) => (
                    <option key={a.code} value={a.code}>
                      USDT — {networkLabel(a.network) || a.name}
                    </option>
                  ))}
                </select>
                {asset && (asset.minSellAmount != null || asset.maxSellAmount != null) && (
                  <p className="mt-1 text-xs text-slate-500">
                    MoonPay limits: {asset.minSellAmount ?? "—"} to {asset.maxSellAmount ?? "—"} USDT
                  </p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="amount">Amount (USDT)</label>
                <input id="amount" inputMode="decimal" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="fiat">Payout currency</label>
                <select id="fiat" className="input" value={fiat} onChange={(e) => setFiat(e.target.value)}>
                  <option value="">Select currency…</option>
                  {corridor.fiatCurrencies.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.code.toUpperCase()} — {f.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Currencies MoonPay supports for sells. MoonPay confirms the final payout currency when the recipient
                  adds their card.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="refund">Your refund wallet address</label>
                <input
                  id="refund"
                  className="input font-mono text-sm"
                  value={refundAddress}
                  onChange={(e) => setRefundAddress(e.target.value)}
                  placeholder={asset?.network ? `Your ${networkLabel(asset.network)} address` : "Wallet address"}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-slate-500">
                  If MoonPay can’t complete the payout, it returns the USDT here. Use a wallet you control.
                </p>
              </div>
              <button className="btn-secondary w-full" disabled={!canQuote || busy} onClick={getQuote}>
                {busy && !quote ? "Getting quote…" : "Get live quote"}
              </button>
            </>
          )}
        </section>
      )}

      {problems.length > 0 && (
        <ul className="card list-disc space-y-1 pl-8 text-sm text-red-700">
          {problems.filter(Boolean).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {quote && (
        <section className="card space-y-4">
          <QuoteBreakdown
            q={{
              ...quote,
              cryptoSymbol: "USDT",
              network: networkLabel(asset?.network),
              providerName: "MoonPay",
            }}
          />
          <button className="btn-primary w-full" disabled={busy || !refundAddress} onClick={createTransfer}>
            {busy ? "Creating…" : "Create transfer"}
          </button>
          <p className="text-xs text-slate-500">
            Next, your recipient verifies with MoonPay and adds a payout card. MoonPay then issues a one-time deposit
            address for this transfer and we show it to you. Don’t send any USDT before then.
          </p>
        </section>
      )}
    </div>
  );
}
