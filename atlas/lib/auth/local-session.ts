import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);
export const LOCAL_SESSION_COOKIE = "atlas-local-session";
export const LOCAL_SESSION_SECONDS = 8 * 60 * 60;
export type LocalAccount = { id: string; email: string; passwordHash: string; sessionSecret: string };

export function localConfigFromEnvironment(env: Record<string, string | undefined>): LocalAccount | null {
  if (env.NODE_ENV === "production" || env.ATLAS_LOCAL_AUTH_ENABLED !== "true") return null;
  const email = env.ATLAS_LOCAL_AUTH_EMAIL?.trim().toLowerCase();
  const passwordHash = env.ATLAS_LOCAL_AUTH_PASSWORD_HASH;
  const sessionSecret = env.ATLAS_LOCAL_AUTH_SESSION_SECRET;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash ?? "") || !sessionSecret || sessionSecret.length < 43) {
    throw new Error("Local account configuration is incomplete. Set its email, scrypt password hash, and session secret in .env.local.");
  }
  return { id: `local:${email}`, email, passwordHash: passwordHash!, sessionSecret };
}

export async function verifyLocalCredentials(account: LocalAccount, email: unknown, password: unknown) {
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 1024) return false;
  const [, salt, expected] = account.passwordHash.split(":");
  const actual = await deriveKey(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, "hex")) && email.trim().toLowerCase() === account.email;
}

function signature(payload: string, account: LocalAccount) {
  // Rotating either the password or secret also invalidates existing sessions.
  return createHmac("sha256", `${account.sessionSecret}:${account.passwordHash}`).update(payload).digest();
}

export function createLocalSession(account: LocalAccount, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: account.id, exp: Math.floor(now / 1000) + LOCAL_SESSION_SECONDS, nonce: randomBytes(16).toString("hex") })).toString("base64url");
  return `${payload}.${signature(payload, account).toString("base64url")}`;
}

export function verifyLocalSession(token: string | undefined, account: LocalAccount, now = Date.now()) {
  if (!token || token.length > 1024) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return false;
  const [payload, encodedSignature] = parts;
  const received = Buffer.from(encodedSignature, "base64url");
  const expected = signature(payload, account);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const timestamp = Math.floor(now / 1000);
    return session.sub === account.id && Number.isSafeInteger(session.exp) && session.exp > timestamp && session.exp <= timestamp + LOCAL_SESSION_SECONDS;
  } catch { return false; }
}
