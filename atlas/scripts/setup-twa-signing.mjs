import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, X509Certificate } from "node:crypto";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const signingDir = path.join(root, "android/signing");
const propertiesFile = path.join(signingDir, "signing.properties");
const keystore = path.join(signingDir, "atlas-release.p12");
const keytool = process.env.ATLAS_KEYTOOL || "keytool";
const exists = async (filename) => fs.access(filename).then(() => true, () => false);
await fs.mkdir(signingDir, { recursive: true });
const hadKey = await exists(keystore);
if (hadKey && !(await exists(propertiesFile))) {
  throw new Error("Existing signing key has no signing.properties. Restore its matching properties from backup; the key will not be overwritten.");
}
if (!hadKey && await exists(propertiesFile)) {
  throw new Error("Signing properties exist without the keystore. Restore the key from backup; a replacement will not be generated silently.");
}
const password = hadKey
  ? (await fs.readFile(propertiesFile, "utf8")).match(/^storePassword=(.+)$/m)?.[1]?.trim()
  : randomBytes(32).toString("base64url");
if (!password) throw new Error("No storePassword in signing.properties");
function run(args) {
  const result = spawnSync(keytool, args, { env: { ...process.env, ATLAS_TWA_KEY_PASSWORD: password }, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`keytool failed: ${result.stderr}`);
}
if (!hadKey) {
  run(["-genkeypair", "-noprompt", "-storetype", "PKCS12", "-keystore", keystore,
    "-alias", "atlas", "-keyalg", "RSA", "-keysize", "3072", "-sigalg", "SHA256withRSA", "-validity", "10000",
    "-dname", "CN=Atlas Android, OU=Atlas, O=Atlas", "-storepass:env", "ATLAS_TWA_KEY_PASSWORD"]);
  await fs.writeFile(propertiesFile, `storeFile=signing/atlas-release.p12\nstorePassword=${password}\nkeyAlias=atlas\nkeyPassword=${password}\n`, { flag: "wx", mode: 0o600 });
}
const certPath = path.join(signingDir, "certificate.der");
run(["-exportcert", "-keystore", keystore, "-alias", "atlas", "-storepass:env", "ATLAS_TWA_KEY_PASSWORD", "-file", certPath]);
const fingerprint = new X509Certificate(await fs.readFile(certPath)).fingerprint256;
const config = JSON.parse(await fs.readFile(path.join(root, "android/twa-config.json"), "utf8"));
const linksPath = path.join(root, "public/.well-known/assetlinks.json");
const links = await exists(linksPath) ? JSON.parse(await fs.readFile(linksPath, "utf8")) : [];
let statement = links.find((item) => item.target?.namespace === "android_app" && item.target.package_name === config.applicationId);
if (!statement) {
  statement = { relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: config.applicationId, sha256_cert_fingerprints: [] } };
  links.push(statement);
}
if (!statement.target.sha256_cert_fingerprints.includes(fingerprint)) statement.target.sha256_cert_fingerprints.push(fingerprint);
await fs.mkdir(path.dirname(linksPath), { recursive: true });
await fs.writeFile(linksPath, `${JSON.stringify(links, null, 2)}\n`);
console.log(`${hadKey ? "Reused" : "Created"} Android release key. Private files: android/signing/ (ignored by Git).`);
console.log(`Public SHA-256: ${fingerprint}`);
console.log("Updated public/.well-known/assetlinks.json. Back up the entire android/signing/ directory securely.");
