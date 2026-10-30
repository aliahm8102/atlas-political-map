import "server-only";
import { createClient } from "@/lib/supabase/server";
import { localAuthConfig } from "@/lib/auth/local";
import { accessRoleSchema, canManageAtlas, type AccessRole, type AdministrationError, type Publication } from "@/lib/administration";

export class AdministrationFailure extends Error {
  constructor(public readonly key: AdministrationError) { super(key); }
}
export function databaseFailure(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "PGRST202" || error.code === "42883" || error.code === "42P01") throw new AdministrationFailure("Administration is not enabled yet.");
  if (error.code === "42501") throw new AdministrationFailure("You do not have permission to manage Atlas.");
  if (error.code === "22023" || error.code === "22P02" || error.code === "23514") throw new AdministrationFailure("Check the character details and try again.");
  throw new AdministrationFailure("The request could not be saved. Refresh and try again.");
}
export async function readAccess(client: Awaited<ReturnType<typeof createClient>>): Promise<{ role: AccessRole; available: boolean }> {
  const result = await client.rpc("current_atlas_role");
  if (result.error && ["PGRST202", "42883", "42P01"].includes(result.error.code)) return { role: "user", available: false };
  databaseFailure(result.error);
  return { role: accessRoleSchema.parse(result.data), available: true };
}
export async function administrationSession(staff = false, owner = false) {
  if (localAuthConfig()) throw new AdministrationFailure("Sign in to publish a character.");
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AdministrationFailure("Sign in to publish a character.");
  const access = await readAccess(client);
  if (!access.available) throw new AdministrationFailure("Administration is not enabled yet.");
  if ((staff && !canManageAtlas(access.role)) || (owner && access.role !== "owner")) throw new AdministrationFailure("You do not have permission to manage Atlas.");
  return { client, userId: data.user.id, role: access.role };
}
export function publicationFromRow(row: Record<string, unknown>): Publication {
  return { id: String(row.id), localId: String(row.local_id), status: row.status as Publication["status"], reviewNote: String(row.review_note), personId: row.person_id == null ? null : String(row.person_id) };
}
