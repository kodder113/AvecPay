import "server-only";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getT } from "@/lib/i18n/server";
import type { Lang, T } from "@/lib/i18n";
import { jsonError } from "@/lib/http";
import { accessState, type AccessState } from "./access";
import { hasFeature, isPlanId, type Feature, type PlanId } from "./plans";
import { isAdmin } from "./admin";
import { emailLayout, sendEmail } from "@/lib/email";

export type Role = "owner" | "manager" | "staff";

export const MERCHANT_COLUMNS =
  "id, user_id, partner_id, business_name, currency, mode, tips_enabled, created_at, plan, price_tier, subscription_status, access_until, past_due_since, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, stripe_account_id, stripe_charges_enabled, stripe_details_submitted, weekly_report";

export interface MerchantRow {
  id: string;
  user_id: string;
  partner_id: string;
  business_name: string;
  currency: string;
  mode: "demo" | "live";
  tips_enabled: boolean;
  created_at: string;
  plan: PlanId | null;
  price_tier: "launch" | "regular" | null;
  subscription_status: string;
  access_until: string | null;
  past_due_since: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_details_submitted: boolean;
  weekly_report: boolean;
}

export interface Business {
  merchant: MerchantRow;
  role: Role;
  access: AccessState;
  /** Starter: this sign-in was replaced by a newer one on another device. */
  deviceBlocked: boolean;
  /** Starter: several devices took turns today (likely a shared login). */
  sharingSuspected: boolean;
}

export type Db = ReturnType<typeof createAdminClient>;

export interface Ctx {
  user: User | null;
  business: Business | null;
  db: Db;
  lang: Lang;
  t: T;
  admin: boolean;
}

/**
 * The signed-in user and the business they belong to (as owner, manager or
 * staff). Accepts a pending team invite for their email on first sign-in.
 * All business data is read with the service client after this check.
 */
export async function loadBusiness(): Promise<Ctx> {
  const { lang, t } = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const db = createAdminClient();
  if (!user) return { user: null, business: null, db, lang, t, admin: false };

  let business = await findMembership(db, user.id);
  if (!business && user.email) {
    // Pending invite for this email: join that business.
    const { data: invite } = await db
      .from("merchant_members")
      .select("id")
      .eq("email", user.email.toLowerCase())
      .eq("status", "invited")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (invite) {
      await db.from("merchant_members").update({ user_id: user.id, status: "active" }).eq("id", invite.id).is("user_id", null);
      // A different query than the first lookup: Next.js memoizes identical GETs within one render.
      business = await findMembership(db, user.id, invite.id);
    }
  }

  if (business && business.merchant.plan === "starter") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const device = await checkStarterDevice(db, user, business, session?.access_token ?? null);
    business.deviceBlocked = device.blocked;
    business.sharingSuspected = device.sharing;
  }
  return { user, business, db, lang, t, admin: isAdmin(user.email) };
}

async function findMembership(db: Db, userId: string, memberId?: string): Promise<Business | null> {
  let q = db.from("merchant_members").select(`role, merchants (${MERCHANT_COLUMNS})`).eq("user_id", userId).eq("status", "active");
  if (memberId) q = q.eq("id", memberId);
  const { data } = await q.maybeSingle();
  if (!data?.merchants) return null;
  const merchant = (Array.isArray(data.merchants) ? data.merchants[0] : data.merchants) as MerchantRow;
  if (!isPlanId(merchant.plan)) merchant.plan = null;
  return { merchant, role: data.role as Role, access: accessState(merchant), deviceBlocked: false, sharingSuspected: false };
}

/** Session id from a Supabase access token (no signature check needed: the session was already verified). */
export function sessionIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { session_id?: string };
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

/**
 * Starter plan: one signed-in device at a time. The newest sign-in wins;
 * older ones are marked superseded and blocked. The owner is emailed about
 * a new device.
 */
async function checkStarterDevice(db: Db, user: User, business: Business, token: string | null): Promise<{ blocked: boolean; sharing: boolean }> {
  const sessionId = sessionIdFromToken(token);
  if (!sessionId) return { blocked: false, sharing: false };
  const { data: rows } = await db.from("user_sessions").select("session_id, superseded_at, first_seen").eq("user_id", user.id);
  const mine = rows?.find((r) => r.session_id === sessionId);
  const now = new Date();
  const dayAgo = now.getTime() - 86_400_000;
  // Distinct sign-ins in the last day, counting this one if it's new.
  const sharing = (rows ?? []).filter((r) => new Date(r.first_seen).getTime() > dayAgo).length + (mine ? 0 : 1) >= 3;

  if (mine) {
    if (mine.superseded_at) return { blocked: true, sharing };
    await db.from("user_sessions").update({ last_seen: now.toISOString() }).eq("user_id", user.id).eq("session_id", sessionId);
    return { blocked: false, sharing };
  }

  // A new sign-in: it becomes the active device; the others are signed out.
  const h = await headers();
  const place = [h.get("x-vercel-ip-city"), h.get("x-vercel-ip-country-region")].filter(Boolean).map((s) => decodeURIComponent(s!)).join(", ") || null;
  const userAgent = (h.get("user-agent") ?? "").slice(0, 200);
  const hadOthers = (rows ?? []).some((r) => !r.superseded_at);
  await db.from("user_sessions").update({ superseded_at: now.toISOString() }).eq("user_id", user.id).is("superseded_at", null);
  await db.from("user_sessions").insert({ user_id: user.id, session_id: sessionId, user_agent: userAgent, place });
  if (hadOthers && user.email) {
    const device = describeDevice(userAgent);
    await sendEmail({
      to: user.email,
      subject: "New sign-in to your Avec account",
      html: emailLayout(
        "New sign-in",
        `<p>Your Avec account (${business.merchant.business_name}) was just opened on <b>${device}</b>${place ? ` near <b>${place}</b>` : ""}. The Starter plan allows one device at a time, so other devices were signed out.</p><p>If this wasn't you, sign in again and your other device will be signed out. Need more people? The Team plan gives each person their own login.</p>`,
      ),
    });
  }
  return { blocked: false, sharing };
}

export function describeDevice(ua: string): string {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "a device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "";
  return browser ? `${os} (${browser})` : os;
}

export interface Guard {
  roles?: Role[];
  /** Needs an active plan (not for billing and settings screens). */
  access?: boolean;
  feature?: Feature;
}

/**
 * For API routes: the caller's business, or a ready JSON error response.
 */
export async function requireBusiness(guard: Guard = {}): Promise<{ ok: true; ctx: Ctx & { user: User; business: Business } } | { ok: false; res: Response }> {
  const ctx = await loadBusiness();
  const { t } = ctx;
  if (!ctx.user) return { ok: false, res: jsonError(401, t({ es: "Inicia sesión", en: "Sign in" })) };
  if (!ctx.business) return { ok: false, res: jsonError(400, t({ es: "Primero configura tu negocio", en: "Set up your business first" })) };
  const b = ctx.business;
  if (b.deviceBlocked) {
    return { ok: false, res: jsonError(401, t({ es: "Tu cuenta se abrió en otro dispositivo. Vuelve a entrar.", en: "Your account was opened on another device. Sign in again." })) };
  }
  if (guard.roles && !guard.roles.includes(b.role)) {
    return { ok: false, res: jsonError(403, t({ es: "Tu rol no permite esta acción", en: "Your role can't do this" })) };
  }
  if (guard.access && !b.access.ok) {
    return { ok: false, res: jsonError(402, t({ es: "Activa un plan para seguir cobrando", en: "Activate a plan to keep taking payments" })) };
  }
  if (guard.feature && !hasFeature(b.merchant.plan, guard.feature)) {
    return { ok: false, res: jsonError(402, t({ es: "Tu plan no incluye esta función", en: "Your plan doesn't include this feature" })) };
  }
  return { ok: true, ctx: ctx as Ctx & { user: User; business: Business } };
}

/** Staff only see charges they created; owners and managers see all. */
export function seesAllCharges(role: Role): boolean {
  return role === "owner" || role === "manager";
}
