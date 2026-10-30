import { z } from "zod";
import type { Country, Person } from "./atlas.ts";
import { getTimelineRange } from "./timeline.ts";

export const accessRoleSchema = z.enum(["user", "admin", "owner"]);
export type AccessRole = z.infer<typeof accessRoleSchema>;
export const canManageAtlas = (role: AccessRole) => role === "admin" || role === "owner";
export const canManageAdmins = (role: AccessRole) => role === "owner";
export const characterImageSchema = z.string().max(300000).refine(value => !value || /^\/(?!\/)[a-zA-Z0-9/_.%\-]+$/.test(value) || /^https:\/\/[^\s]+$/.test(value) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value));
const yearSchema = z.number().finite().min(0).refine(year => year < getTimelineRange().endYear + 1).nullable();
export const managedCharacterSchema = z.object({
  name: z.string().trim().min(1).max(120), title: z.string().trim().min(1).max(240),
  role: z.enum(["leader", "member", "army", "religious", "business"]),
  countryCode: z.string().min(1).max(8), lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180),
  imageUrl: characterImageSchema, startYear: yearSchema, endYear: yearSchema,
}).refine(person => person.startYear === null || person.endYear === null || person.endYear >= person.startYear);
export type ManagedCharacter = z.infer<typeof managedCharacterSchema>;
export const publicationRequestSchema = z.object({ localId: z.string().uuid(), character: managedCharacterSchema });
export const reviewSchema = z.object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(1000) });
export const adminChangeSchema = z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() });
export type PublicationStatus = "pending" | "approved" | "rejected";
export type Publication = { id: string; localId: string; status: PublicationStatus; reviewNote: string; personId: string | null };
export type Submission = Publication & { submitterName: string; createdAt: string; character: ManagedCharacter };
export type AtlasAccount = { userId: string; displayName: string; email: string; role: AccessRole };
export type AdminData = { people: Person[]; submissions: Submission[]; accounts: AtlasAccount[] };
export type AdministrationError = "Sign in to publish a character." | "You do not have permission to manage Atlas." | "Administration is not enabled yet." | "Check the character details and try again." | "The request could not be saved. Refresh and try again.";
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: AdministrationError };
export type AdministrationActions = {
  load: () => Promise<ActionResult<AdminData>>;
  save: (id: string | null, character: ManagedCharacter) => Promise<ActionResult<string>>;
  remove: (id: string) => Promise<ActionResult<null>>;
  review: (id: string, decision: "approved" | "rejected", note: string) => Promise<ActionResult<string | null>>;
  accounts: (query: string) => Promise<ActionResult<AtlasAccount[]>>;
  setAdmin: (userId: string, makeAdmin: boolean) => Promise<ActionResult<null>>;
};

export function characterPayload(person: ManagedCharacter) {
  return { name: person.name, title: person.title, role: person.role, country_code: person.countryCode, latitude: person.lat, longitude: person.lng, image_url: person.imageUrl, start_year: person.startYear, end_year: person.endYear };
}
export function personFromRow(row: Record<string, unknown>, countries: Country[]): Person {
  const country = countries.find(country => country.code === row.country_code);
  return { id: String(row.id), name: String(row.name), title: String(row.title), role: row.role as Person["role"], lat: Number(row.latitude), lng: Number(row.longitude), imageUrl: String(row.image_url), startYear: row.start_year == null ? null : Number(row.start_year), endYear: row.end_year == null ? null : Number(row.end_year), countryCode: String(row.country_code), country: country?.name ?? "Unknown", region: country?.region ?? "Unknown", dataset: String(row.dataset_id) };
}
