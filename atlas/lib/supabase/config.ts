export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if ((url || key) && (!url || !key)) throw new Error("Both Supabase environment variables are required. Set the project URL and public publishable or anon key together.");
  return url && key ? { url, key } : null;
}
