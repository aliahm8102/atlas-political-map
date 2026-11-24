import type { Person } from "./atlas.ts";
import { countryEntities, countryExistsAt } from "./country-entities.ts";
import { getTimelineRange, type TimelineBounds } from "./timeline.ts";

export type DirectoryRange = { from: string; to: string };
export const monthIndex = (value: string) => {
  const match = /^(\d{4}|-\d{6})-(0[1-9]|1[0-2])$/.exec(value);
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : NaN;
};
export function validDirectoryRange(range: DirectoryRange, { min, max }: TimelineBounds = getTimelineRange()) {
  const from = monthIndex(range.from), to = monthIndex(range.to);
  return from >= min && to <= max && from <= to;
}
export function personInRange(person: Person, range: DirectoryRange, bounds: TimelineBounds = getTimelineRange()) {
  if (!validDirectoryRange(range, bounds)) return false;
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
export function countryInRange(code: string, range: DirectoryRange, bounds: TimelineBounds = getTimelineRange()) {
  if (!validDirectoryRange(range, bounds)) return false;
  const entity = countryEntities[code];
  const candidates = [range.from, ...[entity?.foundedOn, ...(entity?.periods.map(period => period.validFrom) ?? [])].filter((value): value is string => Boolean(value)).map(firstActiveMonth)];
  return candidates.some(month => monthIndex(month) >= monthIndex(range.from) && monthIndex(month) <= monthIndex(range.to) && countryExistsAt(code, `${month}-01`));
}
