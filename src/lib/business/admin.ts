/** Avec admins: AVEC_ADMIN_EMAILS (comma-separated), plus the Stripe owner email. */
export function adminEmails(): string[] {
  return [process.env.AVEC_ADMIN_EMAILS ?? "", process.env.AVEC_STRIPE_OWNER_EMAIL ?? ""]
    .flatMap((s) => s.split(","))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string | null | undefined): boolean {
  return Boolean(email && adminEmails().includes(email.trim().toLowerCase()));
}
