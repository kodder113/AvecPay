# MoonPay access checklist: first $10 USDT → Honduras test

This is everything you need from MoonPay (and a few other places) before the first real test:

- **Sender:** United States, sends 10 USDT
- **Recipient:** Christian, Honduras
- **Payout:** eligible Visa debit card via MoonPay card payouts (Visa Direct)

Items are in the order you'll need them.

---

## 1. MoonPay partner account (business / KYB)

- Apply at **moonpay.com/business** and complete business verification (KYB) for the Avec Pay entity.
- Ask for the **Off-Ramp (Sell) product** to be enabled on your account. It is a separate product from On-Ramp (Buy) and may not be on by default.

## 2. Sandbox credentials (needed now, for the sandbox flow)

From **MoonPay Dashboard → Developers**, in *test* mode:

| Env var | Looks like | Used for |
|---|---|---|
| `MOONPAY_PUBLISHABLE_KEY` | `pk_test_…` | Public API calls (currencies, countries, quotes) and the widget `apiKey` |
| `MOONPAY_SECRET_KEY` | `sk_test_…` | Signing widget URLs; `Authorization: Api-Key …` for sell-transaction lookups |
| `MOONPAY_WEBHOOK_KEY` | `wk_test_…` | Verifying the `Moonpay-Signature-V2` header on webhooks |

Also in the dashboard (test mode):

- **Allowed domains / redirect URLs:** add the app's public HTTPS origin (Vercel preview or an ngrok URL). MoonPay's `redirectURL` must be HTTPS.
- **Webhook endpoint:** `https://<your-app>/api/webhooks/moonpay`. Subscribe to the **sell transaction** events (created / updated / completed / failed).
- **URL signing:** turn it on. Avec Pay always signs widget URLs.

## 3. Written answers from your MoonPay account manager

These decide whether the product works as designed. The app is built to *read* these from MoonPay's API where it can. The first one can only be answered by MoonPay.

1. **Third-party funding (the most important one).** In Avec Pay, the MoonPay customer is the *recipient* (Christian): he does KYC and owns the sell order and the payout card. The *sender* sends the USDT to that order's deposit address from their own wallet. MoonPay's sell product normally assumes customers sell crypto they hold themselves. **Ask MoonPay to confirm in writing that a sell order may be funded from a third party's wallet, and whether they need sender information (Travel Rule / originator data).** If they say no, the flow has to change (for example, the recipient receives USDT into a wallet first and then sells). The provider abstraction allows for that, but it's a different product.
2. **Honduras.** Is `isSellAllowed` true for HN on your account? Are card payouts via Visa Direct available to **Honduran-issued Visa debit cards**? Which fiat currency does a Honduran card get paid in? Don't assume HNL; Avec Pay shows whatever MoonPay returns.
3. **USDT networks and minimums.** Which USDT variants are sell-enabled for your account (for example `usdt_trx`, `usdt_polygon`, `usdt` on ERC-20), and what are `minSellAmount` and `maxSellAmount`? **If MoonPay's minimum sell is above 10 USDT, the $10 test can't run as specified.** The preflight script below tells you right away.
4. **Sell widget parameters.** Confirm these are honoured for sells on your account: `externalTransactionId`, `refundWalletAddress`, `lockAmount`, `paymentMethod=credit_debit_card`, `quoteCurrencyCode`, `email`, `redirectURL`.
5. **Partner fee on sells.** If Avec Pay will charge a fee, confirm that `extraFeePercentage` works on sell quotes and sell orders, and how MoonPay settles it to you. Until then, keep `AVECPAY_FEE_PERCENT=0`.
6. **Headless or API-created sell orders (optional).** Ask whether they offer a server-side way to create the sell order and deposit address, instead of only through the hosted widget. The MVP uses the widget, which is the documented path.
7. **Sandbox coverage.** Which USDT assets support test mode in sandbox, and can a sandbox sell reach the card-payout step? The sandbox uses test networks and doesn't pay real cards.

## 4. Production credentials (needed for the real $10 test)

The sandbox never pays a real Visa card. So the real test with Christian needs **live** keys once MoonPay approves go-live:

- `pk_live_…`, `sk_live_…`, `wk_live_…`, and `MOONPAY_ENV=production`
- Live allowed-domain and webhook configuration, the same as in sandbox

The app refuses to start if live keys are used with `MOONPAY_ENV=sandbox`, or the other way round.

## 5. Non-MoonPay prerequisites

- **Supabase project:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Run `supabase/migrations/0001_init.sql`. In Auth → URL configuration, add `https://<your-app>/auth/callback`.
- **Public HTTPS URL** for `NEXT_PUBLIC_APP_URL`. MoonPay redirects and webhooks need one.
- **A sender wallet** holding a little more than 10 USDT on a network MoonPay sell-enables, plus that network's gas token (TRX on Tron, POL on Polygon, ETH on Ethereum).
- **Christian:** a government ID MoonPay accepts, an eligible Visa debit card, and access to his email.
- **Legal:** Avec Pay doesn't custody funds or convert them. It does coordinate payments, and it may charge a fee. Get US counsel to confirm Avec Pay's licensing position (for example, money-transmission analysis) before the fee goes live.

---

## Runbook

### A. Preflight: is the corridor actually supported?

```bash
cp .env.example .env.local   # fill in the keys
npm run moonpay:check -- --country HN --amount 10
```

This prints what MoonPay says: whether selling is allowed in HN, the USDT networks with their min and max, the sell-enabled fiat currencies, and a live quote for each one (rate, MoonPay fee, network fee, Avec Pay fee, recipient amount). If it prints BLOCKERS, stop and resolve them with MoonPay.

### B. Sandbox end to end

1. Run `npm run dev` behind an HTTPS tunnel, with `NEXT_PUBLIC_APP_URL` set to the tunnel URL.
2. Sign in, go to **Send money**, and choose country Honduras, a USDT network, the amount, a payout currency from MoonPay's list, and your refund wallet. Click **Get live quote**, then **Create transfer**.
3. Open the recipient link in a private window and click **Continue with MoonPay**. Complete sandbox KYC and choose card payout.
4. MoonPay redirects back. The transfer page now shows the **one-time deposit address** and status **Awaiting USDT**.
5. Send the test-network USDT to that address, then watch the webhook-driven status: *USDT received → Processing → Payout initiated → Completed*.
6. Check the `webhook_events` table: every row should have `signature_valid = true`.

### C. Live $10 test

Do the same steps with live keys, a real 10 USDT, and Christian doing the recipient steps on his phone. Only send USDT after the deposit address appears in Avec Pay. Send the exact amount, on the exact network shown.
