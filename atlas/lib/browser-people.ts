import { z } from "zod";

export const markerPositionSchema = z.object({ x: z.number().finite().min(0).max(1000), y: z.number().finite().min(0).max(540) });
export type MarkerPosition = z.infer<typeof markerPositionSchema>;
export const customPersonSchema = z.object({
  id: z.string().regex(/^custom:[0-9a-f-]{36}$/),
  name: z.string().trim().min(1).max(120), title: z.string().trim().min(1).max(240),
  role: z.enum(["leader", "member", "army", "religious", "business"]),
  lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180),
  countryCode: z.string().min(1).max(8), country: z.string().min(1).max(120), region: z.string().min(1).max(40),
  imageUrl: z.string().max(300000).refine(value => !value || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)),
  startYear: z.number().min(1900).max(2026.999).nullable(), endYear: z.number().min(1900).max(2026.999).nullable(),
  dataset: z.literal("custom"),
}).refine(person => person.startYear === null || person.endYear === null || person.endYear > person.startYear);
export type CustomPerson = z.infer<typeof customPersonSchema>;
export const browserPeopleSchema = z.object({
  people: z.array(customPersonSchema).max(200),
  positions: z.record(markerPositionSchema),
  bookmarks: z.array(z.string().startsWith("custom:")),
});
export type BrowserPeople = z.infer<typeof browserPeopleSchema>;
export const emptyBrowserPeople: BrowserPeople = { people: [], positions: {}, bookmarks: [] };
export const browserPeopleKey = (userId: string) => `atlas-people-v1:${encodeURIComponent(userId)}`;

export function readBrowserPeople(storage: Pick<Storage, "getItem">, userId: string): BrowserPeople {
  const raw = storage.getItem(browserPeopleKey(userId));
  return raw ? browserPeopleSchema.parse(JSON.parse(raw)) : emptyBrowserPeople;
}
export function writeBrowserPeople(storage: Pick<Storage, "setItem">, userId: string, data: BrowserPeople) {
  const parsed = browserPeopleSchema.parse(data);
  storage.setItem(browserPeopleKey(userId), JSON.stringify(parsed));
  return parsed;
}
