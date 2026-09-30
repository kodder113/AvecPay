/** Avec's fee on card payments, in basis points (50 = 0.5%). Never on tips. */
export function platformFeeBps(): number {
  const n = Number(process.env.AVEC_PLATFORM_FEE_BPS ?? "50");
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n) : 50;
}

export function applicationFeeCents(amountCentsExcludingTip: number, bps = platformFeeBps()): number {
  return Math.max(0, Math.round((amountCentsExcludingTip * bps) / 10_000));
}
