import AuthForm from "@/components/atlas/auth-form";
import { supabaseConfig } from "@/lib/supabase/config";
import { localAuthConfig } from "@/lib/auth/local";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; password?: string }> }) {
  const params = await searchParams;
  const local = !!localAuthConfig();
  return <AuthForm configured={local || !!supabaseConfig()} local={local} confirmationError={!!params.error} passwordUpdated={params.password === "updated"} />;
}
