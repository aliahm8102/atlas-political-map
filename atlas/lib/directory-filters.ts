import type { Person } from "./atlas.ts";
import { countryEntities, countryExistsAt } from "./country-entities.ts";
import { getTimelineRange, TIMELINE_START_YEAR } from "./timeline.ts";

export type DirectoryRange = { from: string; to: string };
export const monthIndex = (value: string) => { const [year, month] = value.split("-").map(Number); return year * 12 + month - 1; };
export function validDirectoryRange(range: DirectoryRange) {
  const valid = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && monthIndex(value) >= TIMELINE_START_YEAR * 12 && monthIndex(value) <= getTimelineRange().max;
  return valid(range.from) && valid(range.to) && range.from <= range.to;
}
export function personInRange(person: Person, range: DirectoryRange) {
  if (!validDirectoryRange(range)) return false;
  // Sample the first day of each included month, just like the map timeline.
  const first = Math.max(monthIndex(range.from), person.startYear === null ? -Infinity : Math.ceil(person.startYear * 12 - .0001));
  return first <= monthIndex(range.to) && (person.endYear === null || first < person.endYear * 12 - .0001);
}
const firstActiveMonth = (date: string) => {
  const month = date.slice(0, 7);
  if (date.endsWith("-01")) return month;
  const index = monthIndex(month) + 1;
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
};
export function countryInRange(code: string, range: DirectoryRange) {
  if (!validDirectoryRange(range)) return false;
  const entity = countryEntities[code];
  const candidates = [range.from, ...[entity?.foundedOn, ...(entity?.periods.map(period => period.validFrom) ?? [])].filter((value): value is string => Boolean(value)).map(firstActiveMonth)];
  return candidates.some(month => month >= range.from && month <= range.to && countryExistsAt(code, `${month}-01`));
}
