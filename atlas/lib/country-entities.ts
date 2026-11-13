import { z } from "zod";
import catalog from "../data/historical-boundaries/catalog.json" with { type: "json" };

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Use a real Gregorian date in YYYY-MM-DD format");
const periodSchema = z.object({ validFrom: isoDateSchema.nullable(), validTo: isoDateSchema.nullable() }).refine(period => period.validFrom === null || period.validTo === null || period.validFrom < period.validTo, "Period end must be after start");
export const countryEntitySchema = z.object({
  code: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1), nameEn: z.string().min(1), nameFa: z.string().min(1),
  region: z.string(), lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180), source: z.string(),
  modern: z.boolean(), foundedOn: isoDateSchema.nullable(), dissolvedOn: isoDateSchema.nullable(), periods: z.array(periodSchema).min(1),
});
export type CountryEntity = z.infer<typeof countryEntitySchema>;
export const countryEntities: Record<string, CountryEntity> = Object.fromEntries(Object.entries(catalog.entities).map(([code, value]) => {
  const parsed = countryEntitySchema.parse(value);
  if (parsed.code !== code) throw new Error(`Country identity mismatch: ${code}`);
  return [code, parsed];
}));
export const historicalCoverage = catalog.coverage;
export const mapDate = (year: number, month = 0) => `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-01`;
export function periodContains(period: { validFrom: string | null; validTo: string | null }, date: string) {
  return (period.validFrom === null || date >= period.validFrom) && (period.validTo === null || date < period.validTo);
}
export function usesHistoricalBorders(date: string) { return periodContains(historicalCoverage, date); }
export function countryExistsAt(code: string, date: string) {
  const entity = countryEntities[code];
  return !entity || (!entity.foundedOn || date >= entity.foundedOn) && (!entity.dissolvedOn || date < entity.dissolvedOn) && (entity.foundedOn !== null || entity.periods.some(period => periodContains(period, date)));
}
export function countryActiveInYear(code: string, year: number) {
  const entity = countryEntities[code];
  if (!entity) return true;
  const from = mapDate(year), to = mapDate(year + 1);
  return (!entity.foundedOn || entity.foundedOn < to) && (!entity.dissolvedOn || entity.dissolvedOn > from) && entity.periods.some(period => (!period.validFrom || period.validFrom < to) && (!period.validTo || period.validTo > from));
}
// Search/deep links to extinct states open the last recorded month of that identity.
export function countryFocusDate(code: string, year: number, month: number) {
  if (countryExistsAt(code, mapDate(year, month))) return { year, month };
  const entity = countryEntities[code];
  if (!entity) return { year, month };
  const first = entity.periods[0].validFrom ?? entity.foundedOn;
  const last = entity.dissolvedOn ?? entity.periods.at(-1)?.validTo;
  if (last && mapDate(year, month) >= last) {
    const date = new Date(Date.parse(`${last}T00:00:00Z`) - 86400000);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
  }
  if (first) {
    const date = new Date(`${first}T00:00:00Z`);
    if (date.getUTCDate() > 1) date.setUTCMonth(date.getUTCMonth() + 1, 1);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
  }
  return { year, month };
}
