import { fa, type TranslationKey } from "./dictionary.ts";
import data from "../../data/locales/fa-data.json" with { type: "json" };
import type { Person } from "../atlas";

export type Locale = "en" | "fa";
export const LOCALE_COOKIE = "atlas-locale";
export type { TranslationKey };

export function resolveLocale(cookie?: string, acceptLanguage = ""): Locale {
  if (cookie === "en" || cookie === "fa") return cookie;
  const preferred = acceptLanguage.split(",").map((part, order) => {
    const [tag, weight] = part.trim().split(";");
    return { language: tag.toLowerCase().split("-")[0], weight: weight ? Number(weight.trim().replace(/^q=/, "")) : 1, order };
  }).filter(item => Number.isFinite(item.weight) && item.weight > 0 && item.weight <= 1).sort((a, b) => b.weight - a.weight || a.order - b.order);
  return preferred.find(item => item.language === "en" || item.language === "fa")?.language === "fa" ? "fa" : "en";
}

const prefixTranslations: [string, string][] = [
  ["President of ", "رئیس‌جمهور "], ["Prime Minister of ", "نخست‌وزیر "],
  ["Chancellor of ", "صدراعظم "], ["Emir of ", "امیر "],
  ["Chief of the General Staff of ", "رئیس ستاد کل "],
  ["Chief of the Defence Staff of ", "رئیس ستاد دفاع "],
  ["Chief of Defence Staff of ", "رئیس ستاد دفاع "],
  ["Minister of Foreign Affairs of ", "وزیر امور خارجهٔ "],
  ["Minister of Defense of ", "وزیر دفاع "], ["Minister of Defence of ", "وزیر دفاع "],
];
const countryTranslations: Record<string, string> = data.countries;
const personTranslations: Record<string, string> = data.people;
const titleTranslations: Record<string, string> = data.titles;

export function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u064b-\u065f\u0670]/g, "").replace(/\u200c/g, " ").replace(/\s+/g, " ").trim();
}

export function createTranslator(locale: Locale) {
  const intlLocale = locale === "fa" ? "fa-IR-u-ca-gregory" : "en-US";
  const n = (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(intlLocale, options).format(value);
  const t = (key: TranslationKey, values: Record<string, string | number> = {}) => {
    const template = locale === "fa" ? fa[key] : key;
    return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => values[key] === undefined ? placeholder : typeof values[key] === "number" ? n(values[key]) : values[key]);
  };
  const text = (value: string) => Object.hasOwn(fa, value) ? t(value as TranslationKey) : value;
  const countryName = (name: string) => locale === "fa" ? countryTranslations[name] ?? name : name;
  const personName = (name: string) => locale === "fa" ? personTranslations[name] ?? name : name;
  const personTitle = (title: string) => {
    if (locale === "en") return title;
    const value = title.trim();
    if (titleTranslations[value]) return titleTranslations[value];
    for (const [prefix, translated] of prefixTranslations) {
      if (!value.startsWith(prefix)) continue;
      const place = value.slice(prefix.length).replace(/^the /, "");
      if (countryTranslations[place]) return translated + countryTranslations[place];
    }
    return title;
  };
  const date = (value: Date | string, options: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" }) => new Intl.DateTimeFormat(intlLocale, { ...options, calendar: "gregory", timeZone: "UTC" }).format(typeof value === "string" ? new Date(value) : value);
  const periodLabel = (person: Person) => `${person.startYear == null ? t("Unknown") : n(Math.floor(person.startYear), { useGrouping: false })} – ${person.endYear == null ? t("Open-ended") : n(Math.floor(person.endYear), { useGrouping: false })}`;
  const matchesPerson = (person: Person, query: string) => normalizeSearch([person.name, person.title, person.country, personName(person.name), personTitle(person.title), countryName(person.country)].join(" ")).includes(normalizeSearch(query));
  return { t, text, n, date, countryName, personName, personTitle, periodLabel, matchesPerson };
}

export function authErrorKey(error: unknown): TranslationKey {
  const message = error instanceof Error ? error.message : "";
  if (Object.hasOwn(fa, message)) return message as TranslationKey;
  const code = typeof error === "object" && error && "code" in error ? error.code : "";
  if (code === "invalid_credentials") return "Incorrect email or password.";
  if (code === "email_not_confirmed") return "Email not confirmed";
  if (code === "user_already_exists") return "User already registered";
  if (code === "over_email_send_rate_limit") return "Email rate limit exceeded";
  if (code === "over_request_rate_limit") return "Too many requests. Please try again later.";
  return "Authentication failed. Please try again.";
}
