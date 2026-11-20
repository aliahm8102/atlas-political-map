import type { Person } from "./atlas.ts";
import { roleLabels } from "./atlas.ts";
import type { BrowserPeople } from "./browser-people.ts";
import { characterDateFields } from "./character-dates.ts";
import type { CountryProfileData } from "./country-profiles.ts";
import type { createTranslator, Locale } from "./i18n/index.ts";

export type ExportCell = string | number | null;
export type ExportTable = { title: string; headers: string[]; rows: ExportCell[][]; rtl: boolean };
export type ExportFormat = "xlsx" | "csv" | "txt";
type Translator = ReturnType<typeof createTranslator>;
const term = (value: number | null) => {
  if (value === null) return null;
  const { year, month } = characterDateFields(value);
  return `${year.padStart(4, "0")}-${String(month + 1).padStart(2, "0")}`;
};

export function peopleExport(people: Person[], organization: Pick<BrowserPeople, "tags" | "groups">, i18n: Translator, locale: Locale): ExportTable {
  const { t, personName, personTitle, countryName, text } = i18n;
  return { title: t("People directory"), rtl: locale === "fa",
    headers: [t("Character name"), t("Office or description"), t("Role"), t("Country"), t("Region"), t("Start date"), t("End date"), t("Tags"), t("Groups"), t("Latitude"), t("Longitude")],
    rows: people.map(person => [locale === "fa" ? person.nameFa || (personName(person) !== person.name ? personName(person) : null) : person.name || null, locale === "fa" ? person.titleFa || (personTitle(person) !== person.title ? personTitle(person) : null) : person.title || null, t(roleLabels[person.role]), countryName(person.country), text(person.region), term(person.startYear), term(person.endYear), (organization.tags[person.id] ?? []).join(", "), organization.groups.filter(group => group.personIds.includes(person.id)).map(group => group.name).join(", "), person.lat, person.lng]),
  };
}

export function countriesExport(profiles: CountryProfileData[], year: number, month: number, i18n: Translator, locale: Locale, endYear = year, endMonth = month): ExportTable {
  const { t, text } = i18n;
  if (year !== endYear) return { title: t("Country directory"), rtl: locale === "fa",
    headers: [t("Country"), t("Region"), t("Start date"), t("End date")],
    rows: profiles.map(profile => [locale === "fa" ? profile.nameFa : profile.nameEn, text(profile.region), `${year}-${String(month + 1).padStart(2, "0")}`, `${endYear}-${String(endMonth + 1).padStart(2, "0")}`]),
  };
  return { title: t("Country directory"), rtl: locale === "fa",
    headers: [t("Country"), t("Capital"), t("Area (km²)"), t("Population"), t("Region"), t("Start date"), t("End date"), t("Flag file path")],
    rows: profiles.map(profile => [locale === "fa" ? profile.nameFa : profile.nameEn, locale === "fa" ? profile.capitalFa : profile.capitalEn, profile.areaKm2, profile.population, text(profile.region), `${year}-${String(month + 1).padStart(2, "0")}`, `${endYear}-${String(endMonth + 1).padStart(2, "0")}`, profile.flagPath]),
  };
}

// CSV/TSV readers may treat leading operators or controls as formulas. Preserve them as text.
function delimitedCell(value: ExportCell, separator: string) {
  let text = value === null ? "" : String(value);
  if (typeof value === "string" && (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return text.includes(separator) || /["\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function delimitedExport(table: ExportTable, separator: "," | "\t") {
  return "\uFEFF" + [table.headers, ...table.rows].map(row => row.map(value => delimitedCell(value, separator)).join(separator)).join("\r\n") + "\r\n";
}

export async function exportFile(table: ExportTable, format: ExportFormat) {
  if (format === "xlsx") {
    const { xlsxExport } = await import("./xlsx-export.ts");
    return new Blob([xlsxExport(table)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  return new Blob([delimitedExport(table, format === "csv" ? "," : "\t")], { type: format === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8" });
}
