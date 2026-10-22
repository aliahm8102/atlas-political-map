import type { SearchState } from "@/lib/search";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import Workspace from "@/components/atlas/workspace";
import { settingsSchema, initialPersonalState, type Person, type Country } from "@/lib/atlas";
import { getLocalAccount, localAuthConfig } from "@/lib/auth/local";

export default async function AuthenticatedWorkspace({ initialPage = "map", initialSearch }: { initialPage?: "map" | "characters" | "search"; initialSearch?: SearchState }) {
  if (localAuthConfig()) {
    const account = await getLocalAccount();
    if (!account) redirect("/login");
    const [people, countries] = await Promise.all([import("@/data/people.json"), import("@/data/countries.json")]);
    return <Workspace key={account.id} initialPage={initialPage} initialSearch={initialSearch} mode="local" userId={account.id} email={account.email} people={people.default as Person[]} countries={countries.default as Country[]} initialState={{ ...initialPersonalState, displayName: "Atlas Demo" }} />;
  }
  if (!supabaseConfig()) redirect("/login");
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/login");
  const userId = auth.claims.sub;
  const results = await Promise.all([
    supabase.from("people").select("*"), supabase.from("countries").select("*"),
    supabase.from("profiles").select("display_name").eq("id", userId).single(),
    supabase.from("user_preferences").select("settings").eq("user_id", userId).single(),
    supabase.from("bookmarks").select("person_id").eq("user_id", userId),
    supabase.from("country_notes").select("country_code,body").eq("user_id", userId),
  ]);
  const failure = results.find(result => result.error);
  if (failure) throw new Error("Could not load the Atlas database. Apply the migrations and try again.");
  const [peopleRows, countryRows, profile, preferences, bookmarks, notes] = results;
  const countries: Country[] = (countryRows.data ?? []).map(row => ({ code: row.code, name: row.name, region: row.region, lat: row.latitude, lng: row.longitude }));
  const people: Person[] = (peopleRows.data ?? []).map(row => {
    const country = countries.find(c => c.code === row.country_code);
    return { id: row.id, name: row.name, title: row.title, role: row.role, lat: row.latitude, lng: row.longitude, imageUrl: row.image_url, startYear: row.start_year === null ? null : Number(row.start_year), endYear: row.end_year === null ? null : Number(row.end_year), countryCode: row.country_code, country: country?.name ?? "Unknown", region: country?.region ?? "Unknown", dataset: row.dataset_id };
  });
  const parsedSettings = settingsSchema.safeParse(preferences.data?.settings ?? {});
  return <Workspace key={userId} initialPage={initialPage} initialSearch={initialSearch} mode="account" userId={userId} email={auth.claims.email as string} people={people} countries={countries} initialState={{ ...initialPersonalState, displayName: profile.data?.display_name ?? "Explorer", settings: parsedSettings.success ? parsedSettings.data : initialPersonalState.settings, bookmarks: (bookmarks.data ?? []).map(row => row.person_id), notes: Object.fromEntries((notes.data ?? []).map(row => [row.country_code, row.body])) }} />;
}
