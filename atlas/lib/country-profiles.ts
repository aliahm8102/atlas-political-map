import data from "../data/country-profiles.json" with { type: "json" };
import { countryEntities, countryExistsAt, mapDate } from "./country-entities.ts";
import type { Country } from "./atlas.ts";
import histories from "../data/country-history/index.ts";
import { countryHistorySchema, countryYear, emptyCountryYear, type CountryHistory, type CountryYear } from "./country-history.ts";

export type CountryMetadata = Country & { nameEn: string; nameFa: string; source: string };
export type CountryProfileData = CountryMetadata & CountryYear & { dataYear: number | null };
export const countryProfiles: Record<string, CountryMetadata> = { ...countryEntities, ...data };
export const countryHistories: Record<string, CountryHistory> = Object.fromEntries(Object.entries(histories).map(([code, data]) => {
  const parsed = countryHistorySchema.safeParse(data);
  if (!parsed.success || parsed.data.code !== code) throw new Error(`Invalid country history: ${code}.json${parsed.success ? "" : `: ${parsed.error.message}`}`);
  return [code, parsed.data];
}));
export function withCountryProfiles(countries: Country[]): Country[] {
  const codes = new Set(countries.map(country => country.code));
  return [...countries, ...Object.values(countryProfiles).filter(country => !codes.has(country.code)).map(({ code, name, region, lat, lng }) => ({ code, name, region, lat, lng }))];
}
export function countryProfile(country: Country, year: number, month = 0): CountryProfileData {
  const metadata = countryProfiles[country.code] ?? { ...country, nameEn: country.name, nameFa: country.name, source: "unavailable" };
  const facts = countryExistsAt(country.code, mapDate(year, month)) ? countryYear(countryHistories[country.code], year) : null;
  return { ...metadata, ...(facts ?? emptyCountryYear), dataYear: facts && Object.values(facts).some(value => value !== null) ? year : null };
}
