import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";
export function createClient() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not connected. Follow the setup guide in README.md.");
  return createBrowserClient(config.url, config.key);
}
