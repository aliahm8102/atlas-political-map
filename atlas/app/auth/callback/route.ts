import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { AUTH_SITE_URL } from "@/lib/auth/urls";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") === "/auth/update-password" ? "/auth/update-password" : "/workspace";
  if (supabaseConfig() && code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, AUTH_SITE_URL), { headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", AUTH_SITE_URL));
}
