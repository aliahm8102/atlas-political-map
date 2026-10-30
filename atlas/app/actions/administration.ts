"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { administrationSession, AdministrationFailure, databaseFailure, publicationFromRow } from "@/lib/administration-server";
import { adminChangeSchema, characterPayload, managedCharacterSchema, personFromRow, publicationRequestSchema, reviewSchema, type ActionResult, type AdminData, type AtlasAccount, type ManagedCharacter, type Publication } from "@/lib/administration";
import type { Country } from "@/lib/atlas";

async function result<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { ok: true, data: await work() }; }
  catch (error) { return { ok: false, error: error instanceof AdministrationFailure ? error.key : error instanceof z.ZodError ? "Check the character details and try again." : "The request could not be saved. Refresh and try again." }; }
}
function invalidate() { revalidatePath("/workspace", "layout"); }
function accountRows(rows: Record<string, unknown>[]): AtlasAccount[] {
  return rows.map(row => ({ userId: String(row.user_id), displayName: String(row.display_name), email: String(row.email), role: row.access_role as AtlasAccount["role"] }));
}
export async function submitCharacter(request: unknown): Promise<ActionResult<Publication>> {
  return result(async () => {
    const { client, userId } = await administrationSession();
    const parsed = publicationRequestSchema.parse(request);
    const submitted = await client.rpc("submit_atlas_character", { local_id: parsed.localId, payload: characterPayload(parsed.character) });
    databaseFailure(submitted.error);
    const saved = await client.from("character_submissions").select("id,local_id,status,review_note,person_id").eq("id", submitted.data).eq("user_id", userId).single();
    databaseFailure(saved.error);
    invalidate();
    return publicationFromRow(saved.data!);
  });
}
export async function loadAdminPanel(): Promise<ActionResult<AdminData>> {
  return result(async () => {
    const { client, role } = await administrationSession(true);
    const [peopleResult, countriesResult, submissionsResult] = await Promise.all([
      client.from("people").select("*").order("name"), client.from("countries").select("*"),
      client.from("character_submissions").select("*").eq("status", "pending").order("created_at").limit(200),
    ]);
    for (const item of [peopleResult, countriesResult, submissionsResult]) databaseFailure(item.error);
    const countries: Country[] = (countriesResult.data ?? []).map(row => ({ code: row.code, name: row.name, region: row.region, lat: row.latitude, lng: row.longitude }));
    const accounts = role === "owner" ? await client.rpc("list_atlas_accounts", { search_query: "" }) : null;
    if (accounts) databaseFailure(accounts.error);
    return {
      people: (peopleResult.data ?? []).map(row => personFromRow(row, countries)),
      submissions: (submissionsResult.data ?? []).map(row => {
        const person = personFromRow(row.character as Record<string, unknown>, countries);
        return { ...publicationFromRow(row), submitterName: row.submitter_name, createdAt: row.created_at, character: managedCharacterSchema.parse(person) };
      }),
      accounts: accountRows(accounts?.data ?? []),
    };
  });
}
export async function saveManagedCharacter(id: string | null, character: ManagedCharacter): Promise<ActionResult<string>> {
  return result(async () => {
    const { client } = await administrationSession(true);
    const personId = id === null ? null : z.string().uuid().parse(id);
    const parsed = managedCharacterSchema.parse(character);
    const saved = await client.rpc("save_atlas_person", { person_id: personId, payload: characterPayload(parsed) });
    databaseFailure(saved.error); invalidate(); return String(saved.data);
  });
}
export async function deleteManagedCharacter(id: string): Promise<ActionResult<null>> {
  return result(async () => {
    const { client } = await administrationSession(true);
    const removed = await client.rpc("delete_atlas_person", { person_id: z.string().uuid().parse(id) });
    databaseFailure(removed.error); invalidate(); return null;
  });
}
export async function reviewCharacter(id: string, decision: "approved" | "rejected", note: string): Promise<ActionResult<string | null>> {
  return result(async () => {
    const { client } = await administrationSession(true);
    const parsed = reviewSchema.parse({ id, decision, note });
    const reviewed = await client.rpc("review_atlas_character", { submission_id: parsed.id, decision: parsed.decision, note: parsed.note });
    databaseFailure(reviewed.error); invalidate(); return reviewed.data == null ? null : String(reviewed.data);
  });
}
export async function searchAtlasAccounts(query: string): Promise<ActionResult<AtlasAccount[]>> {
  return result(async () => {
    const { client } = await administrationSession(false, true);
    const found = await client.rpc("list_atlas_accounts", { search_query: z.string().trim().max(100).parse(query) });
    databaseFailure(found.error); return accountRows(found.data ?? []);
  });
}
export async function setAtlasAdmin(userId: string, makeAdmin: boolean): Promise<ActionResult<null>> {
  return result(async () => {
    const { client } = await administrationSession(false, true);
    const parsed = adminChangeSchema.parse({ userId, makeAdmin });
    const saved = await client.rpc("set_atlas_admin", { target_user: parsed.userId, make_admin: parsed.makeAdmin });
    databaseFailure(saved.error); invalidate(); return null;
  });
}
