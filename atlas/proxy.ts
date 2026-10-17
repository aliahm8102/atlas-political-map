import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { localConfigFromEnvironment, LOCAL_SESSION_COOKIE, verifyLocalSession } from "@/lib/auth/local-session";
export async function proxy(request: NextRequest) {
  const local = localConfigFromEnvironment(process.env);
  if (local) {
    const valid = verifyLocalSession(request.cookies.get(LOCAL_SESSION_COOKIE)?.value, local);
    const response = !valid && request.nextUrl.pathname.startsWith("/workspace")
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const config = supabaseConfig();
  if (!config) {
    if (request.nextUrl.pathname.startsWith("/workspace")) {
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
  if ((error || !data?.claims) && request.nextUrl.pathname.startsWith("/workspace")) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  return response;
}
export const config = { matcher: ["/workspace/:path*", "/auth/:path*"] };
