import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, pickLang, translator, type Lang, type T } from "./index";

/** Language for this request (server components and route handlers). */
export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLang(c.get(LANG_COOKIE)?.value, h.get("accept-language"));
}

export async function getT(): Promise<{ lang: Lang; t: T }> {
  const lang = await getLang();
  return { lang, t: translator(lang) };
}
