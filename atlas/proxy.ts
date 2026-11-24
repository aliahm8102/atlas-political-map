import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { localConfigFromEnvironment, LOCAL_SESSION_COOKIE, verifyLocalSession } from "@/lib/auth/local-session";
import { PUBLIC_LOCALE_HEADER } from "@/lib/seo";
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/" || pathname === "/en") {
    const locale = pathname === "/en" ? "en" : "fa";
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(PUBLIC_LOCALE_HEADER, locale);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (request.cookies.get("atlas-locale")?.value !== locale) response.cookies.set("atlas-locale", locale, { path: "/", maxAge: 31536000, sameSite: "lax", secure: request.nextUrl.protocol === "https:" });
    return response;
  }
  request.headers.delete(PUBLIC_LOCALE_HEADER);
  const loginPage = pathname === "/login" && (request.method === "GET" || request.method === "HEAD");
  const workspace = pathname.startsWith("/workspace");
  const local = localConfigFromEnvironment(process.env);
  if (local) {
    const valid = verifyLocalSession(request.cookies.get(LOCAL_SESSION_COOKIE)?.value, local);
    const destination = valid && loginPage ? "/workspace" : !valid && workspace ? "/login" : null;
    const response = destination ? NextResponse.redirect(new URL(destination, request.url)) : NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const config = supabaseConfig();
  if (!config) {
    if (workspace) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values) {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });
  const { data, error } = await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  const valid = !error && !!data?.claims?.sub;
  const destination = valid && loginPage ? "/workspace" : !valid && workspace ? "/login" : null;
  if (destination) {
    const redirect = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  return response;
}
export const config = { matcher: ["/", "/en", "/login", "/workspace/:path*", "/auth/:path*"] };
