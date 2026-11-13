import { z } from "zod";

const capital = z.string().trim().min(1).max(200).nullable();
export const countryYearSchema = z.object({
  capitalFa: capital.refine(value => value === null || /[\u0600-\u06ff]/.test(value) && !/[a-z]/i.test(value), "Use a Persian capital name or null"),
  capitalEn: capital.refine(value => value === null || !/[\u0600-\u06ff]/.test(value), "Use an English capital name or null"),
  areaKm2: z.number().finite().nonnegative().nullable(),
  population: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  flagPath: z.string().regex(/^\/flags\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:svg|png|webp|jpe?g|gif)$/).nullable(),
}).strict();
export const countryHistorySchema = z.object({
  $schema: z.literal("./schema.json").optional(),
  code: z.string().regex(/^[a-z0-9-]+$/),
  years: z.record(z.string().regex(/^(?:0|[1-9]\d{0,3})$/), countryYearSchema),
}).strict();
export type CountryYear = z.infer<typeof countryYearSchema>;
export type CountryHistory = z.infer<typeof countryHistorySchema>;
export const emptyCountryYear: CountryYear = { capitalFa: null, capitalEn: null, areaKm2: null, population: null, flagPath: null };

// Never substitute a different year's flag, capital, population or area.
export function countryYear(history: CountryHistory | undefined, year: number): CountryYear | null {
  return Number.isInteger(year) && history ? history.years[String(year)] ?? null : null;
}
