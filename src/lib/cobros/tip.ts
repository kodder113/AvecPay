/** Suggested tip percentages shown to the customer. */
export const TIP_PERCENTS = [10, 15, 20] as const;

/** Tip for a percentage of the amount, rounded to the cent (half up), in cents to avoid float drift. */
export function tipForPercent(amount: number | string, percent: number): number {
  const cents = Math.round(Number(amount) * 100);
  return Math.round((cents * percent) / 100) / 100;
}

/**
 * Parses a typed tip. Returns the tip rounded to cents, or null if it isn't
 * a valid amount. The same limit as the database: 0 ≤ tip ≤ the charge.
 */
export function parseTip(input: string, amount: number | string): number | null {
  const t = input.trim().replace(",", ".");
  if (t === "") return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const tip = Math.round(Number(t) * 100) / 100;
  return tip <= Number(amount) ? tip : null;
}

export function addMoney(a: number | string, b: number | string): number {
  return (Math.round(Number(a) * 100) + Math.round(Number(b) * 100)) / 100;
}
