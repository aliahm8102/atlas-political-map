import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "./index";
import { PUBLIC_LOCALE_HEADER } from "../seo";

export async function getLocale() {
  const publicLocale = (await headers()).get(PUBLIC_LOCALE_HEADER);
  if (publicLocale === "fa" || publicLocale === "en") return publicLocale;
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}
