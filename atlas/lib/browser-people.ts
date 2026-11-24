import { z } from "zod";
import { getTimelineRange, TIMELINE_START_YEAR } from "./timeline.ts";
import type { Publication } from "./administration.ts";
import { personProfileId } from "./person-profiles.ts";
import type { Person } from "./atlas.ts";

export const markerPositionSchema = z.object({ x: z.number().finite().min(0).max(1000), y: z.number().finite().min(0).max(540) });
export type MarkerPosition = z.infer<typeof markerPositionSchema>;
const localImageSchema = z.string().max(300000).refine(value => !value || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value));
const hiddenRulesSchema = z.object({
  tags: z.array(z.string().min(1).max(40)),
  groups: z.array(z.string().uuid()),
  roles: z.array(z.enum(["leader", "member", "army", "religious", "business"])),
  people: z.array(z.string().min(1).max(160)),
});
export type HiddenRules = z.infer<typeof hiddenRulesSchema>;
const emptyHiddenRules: HiddenRules = { tags: [], groups: [], roles: [], people: [] };
export const customPersonSchema = z.object({
  id: z.string().regex(/^custom:[0-9a-f-]{36}$/),
  name: z.string().trim().min(1).max(120), title: z.string().trim().min(1).max(240),
  nameFa: z.string().trim().max(120).optional(), titleFa: z.string().trim().max(240).optional(),
  role: z.enum(["leader", "member", "army", "religious", "business"]),
  lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180),
  countryCode: z.string().min(1).max(32), country: z.string().min(1).max(120), region: z.string().min(1).max(40),
  imageUrl: localImageSchema,
  startYear: z.number().min(TIMELINE_START_YEAR).refine(year => year < getTimelineRange().endYear + 1).nullable(), endYear: z.number().min(TIMELINE_START_YEAR).refine(year => year < getTimelineRange().endYear + 1).nullable(),
  dataset: z.literal("custom"),
}).refine(person => person.startYear === null || person.endYear === null || person.endYear > person.startYear);
export type CustomPerson = z.infer<typeof customPersonSchema>;
export const browserPeopleSchema = z.object({
  people: z.array(customPersonSchema).max(200),
  positions: z.record(markerPositionSchema),
  bookmarks: z.array(z.string().min(1).max(160)),
  tags: z.record(z.array(z.string().trim().min(1).max(40)).max(20)).default({}),
  groups: z.array(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60), personIds: z.array(z.string().min(1).max(160)).max(10000) })).max(100).default([]),
  hidden: hiddenRulesSchema.default(emptyHiddenRules),
  profilePhoto: localImageSchema.default(""),
});
export type BrowserPeople = z.infer<typeof browserPeopleSchema>;
export const emptyBrowserPeople: BrowserPeople = { people: [], positions: {}, bookmarks: [], tags: {}, groups: [], hidden: emptyHiddenRules, profilePhoto: "" };
export const browserPeopleKey = (userId: string) => `atlas-people-v1:${encodeURIComponent(userId)}`;

export function readBrowserPeople(storage: Pick<Storage, "getItem">, userId: string): BrowserPeople {
  const raw = storage.getItem(browserPeopleKey(userId));
  if (!raw) return emptyBrowserPeople;
  const data = browserPeopleSchema.parse(JSON.parse(raw));
  const tags = new Map<string, string[]>();
  for (const [id, values] of Object.entries(data.tags)) {
    const profileId = personProfileId(id);
    tags.set(profileId, [...new Set([...(tags.get(profileId) ?? []), ...values])].slice(0, 20));
  }
  return { ...data, tags: Object.fromEntries(tags), bookmarks: [...new Set(data.bookmarks.map(personProfileId))], groups: data.groups.map(group => ({ ...group, personIds: [...new Set(group.personIds.map(personProfileId))] })), hidden: { ...data.hidden, people: [...new Set(data.hidden.people.map(personProfileId))] } };
}

export function shownPeople(people: Person[], { hidden, tags, groups }: Pick<BrowserPeople, "hidden" | "tags" | "groups">) {
  const hiddenIds = new Set(hidden.people);
  const hiddenTags = new Set(hidden.tags);
  for (const [id, values] of Object.entries(tags)) {
    if (values.some(tag => hiddenTags.has(tag))) hiddenIds.add(id);
  }
  for (const group of groups) {
    if (hidden.groups.includes(group.id)) for (const id of group.personIds) hiddenIds.add(id);
  }
  return people.filter(person => !hiddenIds.has(personProfileId(person.id)) && !hidden.roles.includes(person.role));
}
export function writeBrowserPeople(storage: Pick<Storage, "setItem">, userId: string, data: BrowserPeople) {
  const parsed = browserPeopleSchema.parse(data);
  storage.setItem(browserPeopleKey(userId), JSON.stringify(parsed));
  return parsed;
}

export function updateBrowserPerson(data: BrowserPeople, person: CustomPerson): BrowserPeople {
  if (!data.people.some(item => item.id === person.id)) throw new Error("Character no longer exists");
  return { ...data, people: data.people.map(item => item.id === person.id ? customPersonSchema.parse(person) : item) };
}

export function removeBrowserPerson(data: BrowserPeople, id: string): BrowserPeople {
  return { ...data, people: data.people.filter(person => person.id !== id), bookmarks: data.bookmarks.filter(bookmark => bookmark !== id),
    positions: Object.fromEntries(Object.entries(data.positions).filter(([key]) => key !== id)),
    tags: Object.fromEntries(Object.entries(data.tags).filter(([key]) => key !== id)),
    groups: data.groups.map(group => ({ ...group, personIds: group.personIds.filter(key => key !== id) })),
    hidden: { ...data.hidden, people: data.hidden.people.filter(key => key !== id) } };
}

// Approval replaces the private identity, including all browser-only references.
// Reapplying a status snapshot is safe after a storage failure or in another tab.
export function reconcilePublications(data: BrowserPeople, publications: Publication[]): BrowserPeople {
  let next = data;
  for (const publication of publications) {
    if (publication.status !== "approved") continue;
    const id = `custom:${publication.localId}`, target = publication.personId && personProfileId(publication.personId);
    if (!next.people.some(person => person.id === id) && !next.bookmarks.includes(id) && !next.positions[id] && !next.tags[id] && !next.groups.some(group => group.personIds.includes(id)) && !next.hidden.people.includes(id)) continue;
    const previous = next;
    next = removeBrowserPerson(previous, id);
    if (!target) continue;
    next = { ...next,
      bookmarks: [...new Set([...next.bookmarks, ...(previous.bookmarks.includes(id) ? [target] : [])])],
      positions: { ...next.positions, ...(previous.positions[id] && !next.positions[target] ? { [target]: previous.positions[id] } : {}) },
      tags: { ...next.tags, ...(previous.tags[id] ? { [target]: [...new Set([...(next.tags[target] ?? []), ...previous.tags[id]])].slice(0, 20) } : {}) },
      groups: previous.groups.map(group => ({ ...group, personIds: [...new Set(group.personIds.map(key => key === id ? target : key))] })),
      hidden: { ...next.hidden, people: [...new Set(previous.hidden.people.map(key => key === id ? target : key))] },
    };
  }
  return next;
}
