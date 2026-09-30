import type { T } from "@/lib/i18n";
import type { PromoError } from "./billing";

export function promoErrorMessage(e: PromoError, t: T): string {
  switch (e) {
    case "promo_expired":
      return t({ es: "Ese código ya venció.", en: "That code has expired." });
    case "promo_used_up":
      return t({ es: "Ese código ya se usó el máximo de veces.", en: "That code has been used up." });
    case "promo_already_used":
      return t({ es: "Ya usaste ese código.", en: "You've already used that code." });
    case "already_subscribed":
      return t({ es: "Ya tienes un plan pagado activo.", en: "You already have an active paid plan." });
    case "trial_used":
      return t({ es: "Los códigos de prueba son solo para cuentas nuevas.", en: "Trial codes are for new accounts only." });
    default:
      return t({ es: "Código no válido.", en: "That code isn't valid." });
  }
}
