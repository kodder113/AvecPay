# AvecPay (MVP)

A sender pays in crypto (USDT to start). The recipient gets fiat through a regulated off-ramp partner (MoonPay to start), paid to an eligible Visa debit card where MoonPay supports card payouts (Visa Direct).

**AvecPay never custodies funds and never converts crypto.** MoonPay runs KYC, issues the deposit address, does the conversion and makes the payout. AvecPay handles the user experience, quotes, recipient management and status tracking.

> Before the first real test, read **[docs/MOONPAY_SETUP.md](docs/MOONPAY_SETUP.md)**. It lists the credentials you need and the open questions for MoonPay.

## Flow

```
Sender (US)                    AvecPay                          MoonPay                    Recipient (HN)
    │ enter recipient, amount ─▶ live corridor + quote ◀──────── /v3/countries, /v3/currencies,
    │                            (nothing hard-coded)            /v3/currencies/:code/sell_quote
    │ create transfer ─────────▶ transfer: Created, claim link
    │ share link ───────────────────────────────────────────────────────────────────────────▶ opens link
    │                            signed sell-widget URL ───────▶ KYC + payout card (Visa Direct) ◀─┘
    │                            ◀── redirect + webhook ──────── sell order + UNIQUE deposit address
    │ ◀── deposit address shown  (verified via API, never reused) status: Awaiting USDT
    │ sends USDT from own wallet ───────────────────────────────▶ deposit received → convert → payout
    │                            ◀── signed webhooks ─────────── pending / completed / failed
    │ status timeline            Created → Awaiting USDT → USDT received → Processing → Payout initiated → Completed | Failed
```

MoonPay creates the sell order and its deposit address only *after* the recipient finishes KYC and payout setup. So the recipient's step happens before the sender sends USDT. The sender never sees an address until MoonPay has issued it for that one transfer.

## Architecture

| Area | Where |
|---|---|
| Provider interface (add more payout providers here) | `src/lib/providers/types.ts`, `registry.ts` |
| MoonPay adapter (REST, widget signing, webhooks, status mapping) | `src/lib/providers/moonpay/` |
| Status lifecycle (forward-only transitions) | `src/lib/status.ts` |
| Deposit address safety + order reconciliation | `src/lib/reconcile.ts`, `src/lib/transfers.ts` |
| AvecPay fee policy (separate from provider fees) | `src/lib/fees.ts` |
| Database schema + RLS | `supabase/migrations/0001_init.sql` |
| API routes | `src/app/api/*` |
| Webhook endpoint | `POST /api/webhooks/moonpay` |
| UI (mobile-first) | `src/app/{send,dashboard,transfers,recipients,r}` |

### Safety rules in code

- **Nothing about capabilities is hard-coded.** Countries, USDT networks, payout currencies, and min/max limits all come from MoonPay at request time. Quotes are fetched again on the server when a transfer is created.
- **One transfer, one order, one address.** A transfer binds only to a MoonPay order that echoes its `externalTransactionId`, and the order must have the same asset and amount. After that, a different address is rejected. An address already used by another transfer is rejected, backed by a DB unique index. A duplicate order is ignored and its address is never shown.
- **Webhooks are verified, and their bodies are not trusted.** The `Moonpay-Signature-V2` HMAC is checked with a 5-minute tolerance. The order is then read again from MoonPay's authenticated API. Every webhook is logged in `webhook_events`.
- **Status writes happen only on the server.** They use the service role with optimistic concurrency. Users have read-only RLS access to their own transfers.
- **Refunds go to the sender.** The sender gives a refund wallet, which is passed to MoonPay as `refundWalletAddress`.

### Status mapping (MoonPay sell → AvecPay)

| MoonPay | AvecPay |
|---|---|
| (no order yet) | Created |
| `waitingForDeposit` (with a deposit address) | Awaiting USDT |
| `pending` + `depositHash` | USDT received → Processing |
| `completed` | Payout initiated → Completed |
| `failed` | Failed |

MoonPay's documented sell statuses have no separate "payout initiated" state. When MoonPay reports `completed`, meaning it has sent the payout, AvecPay records both steps. Card arrival can take from minutes to about 2 business days after that.

## Running locally

```bash
npm install
cp .env.example .env.local        # fill in Supabase + MoonPay sandbox keys
# apply supabase/migrations/0001_init.sql to your Supabase project
npm run moonpay:check -- --country HN --amount 10   # preflight against MoonPay
npm run dev
```

Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Adding a payout provider

1. Implement `PayoutProvider` (`src/lib/providers/types.ts`). It covers corridor capabilities, quotes, the hosted recipient session, order lookup, and webhook handling.
2. Register it in `src/lib/providers/registry.ts`, and route corridors to it in `providerForCorridor`.
3. The webhook is served automatically at `/api/webhooks/<provider-id>`.
