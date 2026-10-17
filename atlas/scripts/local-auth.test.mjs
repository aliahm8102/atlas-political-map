import test from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { localConfigFromEnvironment, verifyLocalCredentials, createLocalSession, verifyLocalSession, LOCAL_SESSION_SECONDS } from "../lib/auth/local-session.ts";

const password = "Test-only!4-local-account";
const salt = "1234567890abcdef1234567890abcdef";
const env = {
  NODE_ENV: "development",
  ATLAS_LOCAL_AUTH_ENABLED: "true",
  ATLAS_LOCAL_AUTH_EMAIL: "explorer@example.test",
  ATLAS_LOCAL_AUTH_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
  ATLAS_LOCAL_AUTH_SESSION_SECRET: "a".repeat(43),
};
const account = localConfigFromEnvironment(env);

test("local access requires explicit, complete development configuration and is disabled in production", () => {
  assert.equal(localConfigFromEnvironment({}), null);
  assert.equal(localConfigFromEnvironment({ ...env, ATLAS_LOCAL_AUTH_ENABLED: "false" }), null);
  assert.equal(localConfigFromEnvironment({ ...env, NODE_ENV: "production" }), null);
  assert.throws(() => localConfigFromEnvironment({ ...env, ATLAS_LOCAL_AUTH_SESSION_SECRET: "" }));
  assert.throws(() => localConfigFromEnvironment({ ...env, ATLAS_LOCAL_AUTH_PASSWORD_HASH: "plaintext" }));
});

test("local sign-in verifies both the email and scrypt password without accepting malformed input", async () => {
  assert.equal(await verifyLocalCredentials(account, " EXPLORER@example.test ", password), true);
  assert.equal(await verifyLocalCredentials(account, account.email, "wrong-password"), false);
  assert.equal(await verifyLocalCredentials(account, "someone@example.test", password), false);
  assert.equal(await verifyLocalCredentials(account, null, password), false);
  assert.equal(await verifyLocalCredentials(account, account.email, {}), false);
  assert.equal(await verifyLocalCredentials(account, account.email, "x".repeat(1025)), false);
});

test("local sessions reject tampering, expiration, another account, and rotated credentials", () => {
  const now = Date.now();
  const token = createLocalSession(account, now);
  assert.equal(verifyLocalSession(token, account, now), true);
  assert.equal(verifyLocalSession(undefined, account, now), false);
  assert.equal(verifyLocalSession("forged-account", account, now), false);
  assert.equal(verifyLocalSession(token, account, now + LOCAL_SESSION_SECONDS * 1000), false);
  assert.equal(verifyLocalSession(token, { ...account, id: "someone-else" }, now), false);
  assert.equal(verifyLocalSession(token, { ...account, sessionSecret: "b".repeat(43) }, now), false);
  assert.equal(verifyLocalSession(token, { ...account, passwordHash: `${account.passwordHash.slice(0, -1)}0` }, now), false);
  const [body, signature] = token.split(".");
  const forgedBody = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url")), exp: Math.floor(now / 1000) + 999999 })).toString("base64url");
  assert.equal(verifyLocalSession(`${forgedBody}.${signature}`, account, now), false);
});
