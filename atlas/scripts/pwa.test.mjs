import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const source = await fs.readFile(new URL("../public/sw.js", import.meta.url), "utf8");

function worker({ offline = false, keys = [] } = {}) {
  const events = {};
  const deleted = [];
  const requests = [];
  const stored = new Map();
  const cache = {
    addAll: async (assets) => {
      for (const asset of assets) {
        await fs.access(new URL(`../public${asset}`, import.meta.url));
        stored.set(asset, new Response(asset));
      }
    },
    match: async (key) => stored.get(key)?.clone(),
  };
  vm.runInNewContext(source, {
    URL, Response,
    self: { location: { origin: "https://atlas.test" }, clients: { claim: async () => {} }, addEventListener: (name, fn) => { events[name] = fn; } },
    caches: { open: async () => cache, keys: async () => keys, delete: async (key) => { deleted.push(key); } },
    fetch: async (request) => { requests.push(request); if (offline) throw new Error("offline"); return new Response("live"); },
  });
  return {
    stored, deleted, requests,
    async lifecycle(name) { let task; events[name]({ waitUntil: (promise) => { task = promise; } }); await task; },
    fetch(path, { method = "GET", mode = "cors" } = {}) {
      let response;
      events.fetch({ request: { url: new URL(path, "https://atlas.test").href, method, mode }, respondWith: (promise) => { response = promise; } });
      return response;
    },
  };
}

test("installation caches only existing public offline assets; upgrades preserve other caches", async () => {
  const sw = worker({ keys: ["atlas-pwa-v0", "atlas-pwa-v1", "other-app"] });
  await sw.lifecycle("install");
  assert.equal(sw.stored.size, 6);
  assert.ok(sw.stored.has("/offline.html"));
  await sw.lifecycle("activate");
  assert.deepEqual(sw.deleted, ["atlas-pwa-v0"]);
});

test("online protected navigation always uses the network and is never cached", async () => {
  const sw = worker();
  await sw.lifecycle("install");
  assert.equal(await (await sw.fetch("/workspace", { mode: "navigate" })).text(), "live");
  assert.equal(sw.requests.length, 1);
  assert.equal(sw.stored.has("/workspace"), false);
});

test("offline navigation serves the public fallback and icons remain available", async () => {
  const sw = worker({ offline: true });
  await sw.lifecycle("install");
  assert.equal(await (await sw.fetch("/workspace", { mode: "navigate" })).text(), "/offline.html");
  assert.equal(await (await sw.fetch("/icons/icon-192.png")).text(), "/icons/icon-192.png");
});

test("mutations, auth data, RSC requests and third-party URLs bypass worker caching", () => {
  const sw = worker({ offline: true });
  for (const path of ["/workspace?_rsc=123", "/auth/callback?code=secret", "/api/profile", "https://example.test/portrait.png", "/icons/icon-192.png?private=1"]) {
    assert.equal(sw.fetch(path), undefined, path);
  }
  assert.equal(sw.fetch("/workspace", { method: "POST" }), undefined);
});
