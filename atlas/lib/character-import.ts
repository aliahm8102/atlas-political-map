import { roleLabels, type Country, type Person, type Role } from "./atlas.ts";
import { characterImageSchema, managedCharacterSchema, type ManagedCharacter } from "./administration.ts";
import { customPersonSchema, type CustomPerson } from "./browser-people.ts";
import { characterDateFields } from "./character-dates.ts";

export const importColumns = ["id", "name", "title", "role", "countryCode", "nameFa", "titleFa", "lat", "lng", "startDate", "endDate", "imageUrl"] as const;
const requiredColumns = importColumns.slice(0, 5);
export const importLimit = 200;
export type ImportMode = "personal" | "shared";
export type ImportRow = { row: number; fields: Record<string, unknown> };
export type ImportEntry = { id: string | null; character: ManagedCharacter };
type Issue = { row: number; field: string };

export function importRows(sheet: readonly (readonly unknown[])[]) {
  const [header = [], ...body] = sheet;
  const columns = header.map(value => typeof value === "string" ? value.trim().toLowerCase() : "");
  if (columns[0] !== "id" || requiredColumns.some(name => !columns.includes(name.toLowerCase())) ||
      new Set(columns.filter(Boolean)).size !== columns.filter(Boolean).length) return null;
  return body.flatMap((cells, index): ImportRow[] =>
    cells.some(cell => cell != null && cell !== "") ? [{ row: index + 2, fields: Object.fromEntries(columns.map((column, i) => [column, cells[i]])) }] : []);
}

function optionalText(value: unknown, max: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : undefined;
}
function coordinate(value: unknown, limit: number) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : undefined;
}
function optionalDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getUTCFullYear() + value.getUTCMonth() / 12;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = /^(\d{1,4})(?:-(0[1-9]|1[0-2])(?:-\d{2})?)?$/.exec(String(value ?? "").trim());
  return match ? Number(match[1]) + (match[2] ? (Number(match[2]) - 1) / 12 : 0) : undefined;
}

export function planCharacterImport(rows: ImportRow[], people: Person[], countries: Country[], mode: ImportMode) {
  const issues: Issue[] = [], entries: ImportEntry[] = [];
  const known = new Map(people.map(person => [person.id, person]));
  const countryByCode = new Map(countries.map(country => [country.code, country]));
  const seen = new Set<string>();
  for (const { row, fields } of rows) {
    const id = String(fields.id ?? "").trim().toLowerCase() || null;
    const previous = id ? known.get(id) : undefined;
    const name = optionalText(fields.name, 120), title = optionalText(fields.title, 240);
    const role = String(fields.role ?? "").trim().toLowerCase();
    const rawCode = String(fields.countrycode ?? "").trim();
    const country = countryByCode.get(rawCode) ?? (/^\d{1,3}$/.test(rawCode) ? countryByCode.get(rawCode.padStart(3, "0")) : undefined);
    if (id && (!previous || seen.has(id))) issues.push({ row, field: "id" });
    if (id) seen.add(id);
    if (!name) issues.push({ row, field: "name" });
    if (!title) issues.push({ row, field: "title" });
    if (!Object.hasOwn(roleLabels, role)) issues.push({ row, field: "role" });
    if (!country) issues.push({ row, field: "countryCode" });
    if (!name || !title || !country || issues.at(-1)?.row === row) continue;

    const image = optionalText(fields.imageurl, 300000);
    const sameCountry = previous?.countryCode === country.code;
    let character: ManagedCharacter = {
      name, title, role: role as Role, countryCode: country.code,
      nameFa: optionalText(fields.namefa, 120) ?? previous?.nameFa ?? "",
      titleFa: optionalText(fields.titlefa, 240) ?? previous?.titleFa ?? "",
      lat: coordinate(fields.lat, 90) ?? (sameCountry ? previous.lat : country.lat),
      lng: coordinate(fields.lng, 180) ?? (sameCountry ? previous.lng : country.lng),
      imageUrl: previous?.imageUrl ?? "", startYear: previous?.startYear ?? null, endYear: previous?.endYear ?? null,
    };
    const supports = (candidate: ManagedCharacter) => mode === "shared" ? managedCharacterSchema.safeParse(candidate).success :
      customPersonSchema.safeParse(asCustom(candidate, country, "custom:00000000-0000-4000-8000-000000000000")).success;
    if (image && characterImageSchema.safeParse(image).success && supports({ ...character, imageUrl: image })) character = { ...character, imageUrl: image };
    const start = optionalDate(fields.startdate), end = optionalDate(fields.enddate);
    const dated = { ...character, startYear: start ?? character.startYear, endYear: end ?? character.endYear };
    if (supports(dated)) character = dated;
    else {
      if (start !== undefined && supports({ ...character, startYear: start })) character = { ...character, startYear: start };
      if (end !== undefined && supports({ ...character, endYear: end })) character = { ...character, endYear: end };
    }
    entries.push({ id, character });
  }
  return { entries, issues };
}

function asCustom(character: ManagedCharacter, country: Country, id: string): CustomPerson {
  return { ...character, id, country: country.name, region: country.region, dataset: "custom" };
}

export function applyPersonalImport(people: CustomPerson[], rows: ImportRow[], countries: Country[]) {
  const { entries, issues } = planCharacterImport(rows, people, countries, "personal");
  if (!rows.length || rows.length > importLimit || issues.length || people.length + entries.filter(entry => !entry.id).length > importLimit) throw new Error("Invalid character import");
  const next = new Map(people.map(person => [person.id, person]));
  for (const { id, character } of entries) {
    const country = countries.find(item => item.code === character.countryCode)!;
    const person = customPersonSchema.parse(asCustom(character, country, id ?? `custom:${crypto.randomUUID()}`));
    next.set(person.id, person);
  }
  return [...next.values()];
}

export function importablePersonRow(person: Person) {
  const term = (value: number | null) => {
    if (value === null) return null;
    if (Math.abs(value * 12 - Math.round(value * 12)) > 0.00001) return value;
    const { year, month } = characterDateFields(value);
    return `${year.padStart(4, "0")}-${String(month + 1).padStart(2, "0")}`;
  };
  return [person.id, person.name, person.title, person.role, person.countryCode, person.nameFa ?? "", person.titleFa ?? "", person.lat, person.lng, term(person.startYear), term(person.endYear), person.imageUrl.length <= 32767 ? person.imageUrl : ""];
}
