import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "./index";

export async function getLocale() {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}
