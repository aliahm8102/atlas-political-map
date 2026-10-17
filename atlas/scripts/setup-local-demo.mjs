import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";

const credentialsFile = ".env.demo.local";
const envFile = ".env.local";
const readValues = text => Object.fromEntries(text.split("\n").filter(line => line && !line.startsWith("#") && line.includes("=")).map(line => {
  const i = line.indexOf("=");
  return [line.slice(0, i), line.slice(i + 1)];
}));

const existing = existsSync(credentialsFile);
const credentials = existing ? readValues(readFileSync(credentialsFile, "utf8")) : {
  ATLAS_DEMO_EMAIL: process.env.ATLAS_DEMO_EMAIL || "demo@atlas.local",
  ATLAS_DEMO_PASSWORD: `At!7-${randomBytes(24).toString("base64url")}`,
};
const email = credentials.ATLAS_DEMO_EMAIL?.trim().toLowerCase();
const password = credentials.ATLAS_DEMO_PASSWORD;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email) || !password || password.length < 16) {
  throw new Error("The local demo needs a valid email and a password of at least 16 characters.");
}

const salt = randomBytes(16).toString("hex");
const values = {
  ATLAS_LOCAL_AUTH_ENABLED: "true",
  ATLAS_LOCAL_AUTH_EMAIL: email,
  ATLAS_LOCAL_AUTH_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
  ATLAS_LOCAL_AUTH_SESSION_SECRET: randomBytes(32).toString("base64url"),
};
const lines = existsSync(envFile) ? readFileSync(envFile, "utf8").trimEnd().split("\n") : [];
const seen = new Set();
for (let i = 0; i < lines.length; i++) {
  const key = lines[i].split("=")[0];
  if (key in values) { lines[i] = `${key}=${values[key]}`; seen.add(key); }
}
for (const [key, value] of Object.entries(values)) if (!seen.has(key)) lines.push(`${key}=${value}`);
if (!existing) writeFileSync(credentialsFile, `# Local demo credentials; never commit.\nATLAS_DEMO_EMAIL=${email}\nATLAS_DEMO_PASSWORD=${password}\n`, { mode: 0o600, flag: "wx" });
writeFileSync(envFile, `${lines.join("\n")}\n`, { mode: 0o600 });
chmodSync(credentialsFile, 0o600);
chmodSync(envFile, 0o600);
console.log(`Local demo enabled for ${email}. Credentials are in ${credentialsFile}. Restart npm run dev. Existing sessions were invalidated.`);
