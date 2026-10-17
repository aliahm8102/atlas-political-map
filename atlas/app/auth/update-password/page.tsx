import AuthForm from "@/components/atlas/auth-form";
import { supabaseConfig } from "@/lib/supabase/config";
import { localAuthConfig } from "@/lib/auth/local";
import { redirect } from "next/navigation";
export default function UpdatePassword() {
  if (localAuthConfig()) redirect("/login");
  return <AuthForm configured={!!supabaseConfig()} updatePassword />;
}
