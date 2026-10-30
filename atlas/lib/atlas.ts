import { z } from "zod";
import { getTimelineRange, TIMELINE_START_YEAR } from "./timeline.ts";
export const roleLabels = { leader: "Heads of state", member: "Government", army: "Military", religious: "Religious", business: "Business" } as const;
export type Role = keyof typeof roleLabels;
export type Person = {
  id: string; name: string; title: string; role: Role; lat: number; lng: number;
  imageUrl: string; startYear: number | null; endYear: number | null;
  countryCode: string; country: string; region: string; dataset: string;
};
export type Country = { code: string; name: string; region: string; lat: number; lng: number };
export const regions = ["All regions", "Europe", "Asia", "Africa", "North America", "South America", "Oceania"] as const;
export const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "sand", "midnight"]).default("light"),
  accent: z.enum(["sage", "blue", "lavender", "amber", "rose"]).default("sage"),
  fontSize: z.number().int().min(90).max(130).default(100),
  portraits: z.boolean().default(true), labels: z.boolean().default(true),
  markerSize: z.enum(["small", "medium", "large"]).default("medium"),
  year: z.number().int().min(TIMELINE_START_YEAR).refine(year => year <= getTimelineRange().endYear).default(() => getTimelineRange().currentYear),
  month: z.number().int().min(0).max(11).default(() => getTimelineRange().currentMonth),
  region: z.enum(regions).default("All regions"),
  roles: z.array(z.enum(["leader", "member", "army", "religious", "business"])).default(["leader", "member", "army", "religious", "business"]),
  nato: z.boolean().default(false),
}).refine(settings => settings.year * 12 + settings.month <= getTimelineRange().max, { path: ["month"], message: "Date must be within the timeline." });
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings = settingsSchema.parse({});
export const MIN_MAP_ZOOM = 1;
export const MAX_MAP_ZOOM = 64;
export const viewportSchema = z.object({ x: z.number().finite(), y: z.number().finite(), k: z.number().min(MIN_MAP_ZOOM).max(MAX_MAP_ZOOM) });
export type Viewport = z.infer<typeof viewportSchema>;
export const defaultViewport: Viewport = { x: 0, y: 0, k: 1 };
export type MapBounds = { x: number; y: number; width: number; height: number };
const defaultMapBounds: MapBounds = { x: 0, y: 0, width: 1000, height: 540 };
export function constrainViewport(view: Viewport, bounds = defaultMapBounds): Viewport {
  const k = Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, view.k));
  // Letterboxing is outside the map; only a cropped map changes the pan limits.
  return { k, x: Math.min(Math.max(0, bounds.x) + 80, Math.max(Math.min(1000, bounds.x + bounds.width) - 1000 * k - 80, view.x)), y: Math.min(Math.max(0, bounds.y) + 80, Math.max(Math.min(540, bounds.y + bounds.height) - 540 * k - 80, view.y)) };
}
export function zoomViewport(view: Viewport, factor: number, anchor = { x: 500, y: 270 }, bounds = defaultMapBounds): Viewport {
  const k = Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, view.k * factor));
  return constrainViewport({ k, x: anchor.x - (anchor.x - view.x) * k / view.k, y: anchor.y - (anchor.y - view.y) * k / view.k }, bounds);
}
export const localStateSchema = z.object({ settings: settingsSchema, bookmarks: z.array(z.string()).default([]), notes: z.record(z.string()).default({}), displayName: z.string().max(80).default("Explorer") });
export type PersonalState = z.infer<typeof localStateSchema>;
export const initialPersonalState: PersonalState = { settings: defaultSettings, bookmarks: [], notes: {}, displayName: "Explorer" };
export function visiblePeople(people: Person[], settings: Settings, search = "") {
  const date = settings.year + settings.month / 12;
  const query = search.toLocaleLowerCase().trim();
  return people.filter(p => (p.startYear === null || p.startYear <= date) && (p.endYear === null || date < p.endYear) && settings.roles.includes(p.role) && (settings.region === "All regions" || p.region === settings.region) && (!query || `${p.name} ${p.title} ${p.country}`.toLocaleLowerCase().includes(query)));
}
export function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase(); }
export function period(person: Person) { return `${person.startYear ? Math.floor(person.startYear) : "Unknown"} – ${person.endYear ? Math.floor(person.endYear) : "Open-ended"}`; }
