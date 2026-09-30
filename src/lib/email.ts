import "server-only";

/**
 * Transactional email through Resend (the same service Supabase uses for
 * login codes). Off until RESEND_API_KEY and EMAIL_FROM are set; callers
 * treat "not sent" as a soft failure.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendEmail(input: { to: string; subject: string; html: string; text?: string }): Promise<{ sent: boolean; error?: string }> {
  if (!emailConfigured()) return { sent: false, error: "not_configured" };
  const base = (process.env.RESEND_API_BASE ?? "https://api.resend.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
      cache: "no-store",
    });
    if (!res.ok) return { sent: false, error: `resend_${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A plain branded email body. */
export function emailLayout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="background:#F2E04A;color:#1B1E25;padding:12px 20px;border-radius:10px;font-weight:700;text-decoration:none">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1B1E25">
<div style="background:#1B1E25;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:900;font-style:italic;font-size:20px">Avec Pay</div>
<div style="border:1px solid #e2e8f0;border-top:0;padding:20px;border-radius:0 0 12px 12px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>${bodyHtml}${button}
</div></div>`;
}
