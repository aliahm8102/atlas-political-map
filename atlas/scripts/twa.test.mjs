import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash, X509Certificate } from "node:crypto";

const config = JSON.parse(await fs.readFile(new URL("../android/twa-config.json", import.meta.url), "utf8"));
const assetLinks = JSON.parse(await fs.readFile(new URL("../public/.well-known/assetlinks.json", import.meta.url), "utf8"));
const androidLink = assetLinks.find((item) => item.target?.package_name === config.applicationId);

test("Android and the website delegate to the same package with real SHA-256 fingerprints", () => {
  assert.equal(config.origin, "https://atlas-peyma.ir");
  assert.equal(config.launchPath, "/");
  assert.match(config.applicationId, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/);
  assert.deepEqual(androidLink.relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(androidLink.target.namespace, "android_app");
  assert.ok(androidLink.target.sha256_cert_fingerprints.length > 0);
  for (const fingerprint of androidLink.target.sha256_cert_fingerprints) {
    assert.match(fingerprint, /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/);
    assert.notEqual(fingerprint, Array(32).fill("00").join(":"));
  }
});

test("published fingerprint matches the locally generated signing certificate when present", async (context) => {
  let cert;
  try { cert = await fs.readFile(new URL("../android/signing/certificate.der", import.meta.url)); }
  catch (error) { if (error.code === "ENOENT") { context.skip("Private signing directory is intentionally absent from fresh checkouts"); return; } throw error; }
  const certificate = new X509Certificate(cert);
  assert.ok(androidLink.target.sha256_cert_fingerprints.includes(certificate.fingerprint256));
  assert.ok(Date.parse(certificate.validTo) > Date.now());
});

test("the checked-in Gradle wrapper matches the official Gradle 8.13 SHA-256", async () => {
  const jar = await fs.readFile(new URL("../android/gradle/wrapper/gradle-wrapper.jar", import.meta.url));
  assert.equal(createHash("sha256").update(jar).digest("hex"), "81a82aaea5abcc8ff68b3dfcb58b3c3c429378efd98e7433460610fecd7ae45f");
});
