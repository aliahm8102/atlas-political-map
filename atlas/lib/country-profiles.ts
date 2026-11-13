import data from "../data/country-profiles.json" with { type: "json" };
import type { Country } from "./atlas.ts";

export type CountryProfileData = Country & { nameEn: string; nameFa: string; capital: string | null; capitalFa: string | null; areaKm2: number | null; population: number | null; flag: string; source: string };
export const countryProfiles = data as Record<string, CountryProfileData>;
export function withCountryProfiles(countries: Country[]): Country[] {
  const codes = new Set(countries.map(country => country.code));
  return [...countries, ...Object.values(countryProfiles).filter(country => !codes.has(country.code)).map(({ code, name, region, lat, lng }) => ({ code, name, region, lat, lng }))];
}
export function countryProfile(country: Country): CountryProfileData {
  return countryProfiles[country.code] ?? { ...country, nameEn: country.name, nameFa: country.name, capital: null, capitalFa: null, areaKm2: null, population: null, flag: "", source: "unavailable" };
}
