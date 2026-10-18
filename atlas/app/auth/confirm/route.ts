import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { AUTH_SITE_URL } from "@/lib/auth/urls";
export async function GET(request: Request) {
  const url = new URL(request.url); const token_hash = url.searchParams.get("token_hash"); const type = url.searchParams.get("type");
  if (supabaseConfig() && token_hash && (type === "email" || type === "signup" || type === "recovery")) {
    const supabase = await createClient(); const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/auth/update-password" : "/workspace", AUTH_SITE_URL), { headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", AUTH_SITE_URL));
}
