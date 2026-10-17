"use server";

import { cookies } from "next/headers";
import { localAuthConfig } from "@/lib/auth/local";
import { createLocalSession, LOCAL_SESSION_COOKIE, LOCAL_SESSION_SECONDS, verifyLocalCredentials } from "@/lib/auth/local-session";

export async function signInLocally(email: string, password: string) {
  const account = localAuthConfig();
  if (!account) return { error: "Local sign-in is unavailable." };
  if (!await verifyLocalCredentials(account, email, password)) return { error: "Incorrect email or password." };
  (await cookies()).set(LOCAL_SESSION_COOKIE, createLocalSession(account), { httpOnly: true, sameSite: "strict", secure: false, path: "/", maxAge: LOCAL_SESSION_SECONDS });
  return { error: null };
}

export async function signOutLocally() {
  (await cookies()).delete(LOCAL_SESSION_COOKIE);
}
