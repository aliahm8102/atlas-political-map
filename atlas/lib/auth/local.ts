import "server-only";
import { cookies } from "next/headers";
import { localConfigFromEnvironment, LOCAL_SESSION_COOKIE, verifyLocalSession } from "./local-session";

export function localAuthConfig() {
  return localConfigFromEnvironment(process.env);
}

export async function getLocalAccount() {
  const account = localAuthConfig();
  if (!account || !verifyLocalSession((await cookies()).get(LOCAL_SESSION_COOKIE)?.value, account)) return null;
  return { id: account.id, email: account.email };
}
