import type { Tr } from "@/lib/i18n";

/**
 * Avec plans. Merchants pay Avec monthly for the software; launch prices are
 * locked for life for merchants who activate while the launch offer is on.
 */
export const PLAN_IDS = ["starter", "team", "business"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type PriceTier = "launch" | "regular";

export type Feature =
  | "ticket_qr" // ticket / invoice QRs that stay open for days
  | "employee_qr" // permanent QR per team member
  | "team" // invite team members, roles
  | "per_employee" // sales and tips per team member
  | "unpaid_tickets" // unpaid ticket list and email reminders
  | "csv" // CSV export
  | "ai"; // AI weekly report and questions

export interface Plan {
  id: PlanId;
  name: string;
  seats: number;
  /** Monthly price in cents. */
  cents: Record<PriceTier, number>;
  features: readonly Feature[];
  blurb: Tr;
  bullets: readonly Tr[];
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    seats: 1,
    cents: { launch: 1999, regular: 2900 },
    features: [],
    blurb: { en: "For one person taking payments.", es: "Para una persona que cobra." },
    bullets: [
      { en: "1 user (one device at a time)", es: "1 usuario (un dispositivo a la vez)" },
      { en: "Quick-sale QR codes", es: "QR de venta rápida" },
      { en: "Permanent QR and tip QR to print", es: "QR permanente y QR de propinas para imprimir" },
      { en: "Card, Apple Pay, Google Pay, Zelle, Venmo, Cash App", es: "Tarjeta, Apple Pay, Google Pay, Zelle, Venmo, Cash App" },
      { en: "Sales dashboard and history", es: "Panel de ventas e historial" },
    ],
  },
  team: {
    id: "team",
    name: "Team",
    seats: 5,
    cents: { launch: 4900, regular: 6900 },
    features: ["ticket_qr", "employee_qr", "team", "per_employee"],
    blurb: { en: "For shops with techs in the field.", es: "Para negocios con técnicos en la calle." },
    bullets: [
      { en: "Up to 5 users", es: "Hasta 5 usuarios" },
      { en: "Everything in Starter", es: "Todo lo de Starter" },
      { en: "Ticket / invoice QRs that stay open for days", es: "QR de ticket / factura que quedan abiertos por días" },
      { en: "A QR for each tech", es: "Un QR para cada técnico" },
      { en: "Sales and tips per employee", es: "Ventas y propinas por empleado" },
    ],
  },
  business: {
    id: "business",
    name: "Business",
    seats: 15,
    cents: { launch: 9900, regular: 14900 },
    features: ["ticket_qr", "employee_qr", "team", "per_employee", "unpaid_tickets", "csv", "ai"],
    blurb: { en: "For growing teams that want the numbers.", es: "Para equipos que quieren los números." },
    bullets: [
      { en: "Up to 15 users", es: "Hasta 15 usuarios" },
      { en: "Everything in Team", es: "Todo lo de Team" },
      { en: "AI weekly report and questions", es: "Reporte semanal con IA y preguntas" },
      { en: "Unpaid tickets with email reminders", es: "Tickets sin pagar con recordatorios por correo" },
      { en: "CSV export for your accountant", es: "Exportar CSV para tu contador" },
    ],
  },
};

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && (PLAN_IDS as readonly string[]).includes(v);
}

export function hasFeature(plan: PlanId | null | undefined, feature: Feature): boolean {
  return Boolean(plan && PLANS[plan].features.includes(feature));
}

export function seatsFor(plan: PlanId | null | undefined): number {
  return plan ? PLANS[plan].seats : 1;
}

/** The cheapest plan that includes a feature (for "Upgrade to …" prompts). */
export function planWith(feature: Feature): PlanId {
  return PLAN_IDS.find((p) => PLANS[p].features.includes(feature)) ?? "business";
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
