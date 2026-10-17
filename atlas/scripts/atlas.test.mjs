import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { visiblePeople, defaultSettings, settingsSchema, localStateSchema, viewportSchema, savedViewSchema, zoomViewport, defaultViewport, MAX_MAP_ZOOM } from "../lib/atlas.ts";
const people = JSON.parse(fs.readFileSync(new URL("../data/people.json", import.meta.url)));
const countries = JSON.parse(fs.readFileSync(new URL("../data/countries.json", import.meta.url)));

test("the complete source collection imports with stable, distinct IDs and valid country references", () => {
  assert.equal(people.length, 156);
  assert.equal(new Set(people.map(p => p.id)).size, 156);
  for (const p of people) {
    assert.match(p.id, /^[a-f0-9-]{36}$/);
    assert.ok(countries.some(c => c.code === p.countryCode));
    assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
    assert.ok(["leader", "member", "army", "religious", "business"].includes(p.role), p.name);
    if (p.imageUrl.startsWith("/")) assert.ok(fs.existsSync(new URL(`../public${p.imageUrl}`, import.meta.url)), p.imageUrl);
  }
});
test("a transition year displays the new term and excludes the previous term", () => {
  const results = visiblePeople(people, { ...defaultSettings, year: 2025, month: 0 });
  assert.equal(results.filter(p => p.name === "Donald Trump").length, 1);
  assert.ok(!results.some(p => p.name === "Joe Biden"));
  const earlier = visiblePeople(people, { ...defaultSettings, year: 2024, month: 0 });
  assert.ok(earlier.some(p => p.name === "Joe Biden"));
  assert.ok(!earlier.some(p => p.name === "Donald Trump"));
});
test("historical selection, role, region, and search all narrow the collection", () => {
  const history = visiblePeople(people, { ...defaultSettings, year: 1942, month: 0 });
  assert.ok(history.some(p => p.name === "Sir Winston Churchill"));
  assert.ok(!history.some(p => p.name === "Keir Starmer"));
  const filtered = visiblePeople(people, { ...defaultSettings, region: "Asia", roles: ["leader"] }, "India");
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every(p => p.region === "Asia" && p.role === "leader" && p.country === "India"));
  assert.equal(visiblePeople(people, { ...defaultSettings, roles: [] }).length, 0);
});
test("saved preferences accept December and reject corrupt or out-of-range state", () => {
  assert.equal(settingsSchema.parse({ month: 11 }).month, 11);
  assert.equal(settingsSchema.safeParse({ month: 12 }).success, false);
  assert.equal(settingsSchema.safeParse({ year: 2050 }).success, false);
  assert.equal(localStateSchema.safeParse({ settings: { theme: "untrusted" } }).success, false);
});
test("region assignment keeps the source Iranian and Indian records in Asia", () => {
  assert.ok(people.filter(p => p.dataset === "iran").every(p => p.region === "Asia"));
  assert.equal(people.find(p => p.name === "Narendra Modi").region, "Asia");
});
test("deep zoom preserves its anchor and clamps buttons and wheel factors to the same limits", () => {
  const anchor = { x: 650, y: 320 };
  const zoomed = zoomViewport(defaultViewport, 16, anchor);
  assert.equal(zoomed.k, 16);
  assert.equal((anchor.x - zoomed.x) / zoomed.k, anchor.x);
  assert.equal((anchor.y - zoomed.y) / zoomed.k, anchor.y);
  const maximum = zoomViewport(zoomed, Infinity, anchor);
  assert.equal(maximum.k, MAX_MAP_ZOOM);
  assert.ok(Number.isFinite(maximum.x) && Number.isFinite(maximum.y));
  assert.equal(zoomViewport(maximum, 0).k, 1);
});
test("saved views retain zoom above the old limit without accepting invalid scale", () => {
  const view = { id: "test-view", name: "Close-up", settings: defaultSettings, viewport: zoomViewport(defaultViewport, 64), createdAt: new Date().toISOString() };
  assert.equal(savedViewSchema.parse(JSON.parse(JSON.stringify(view))).viewport.k, 64);
  assert.equal(viewportSchema.safeParse({ x: 0, y: 0, k: 65 }).success, false);
  assert.equal(viewportSchema.safeParse({ x: 0, y: 0, k: .5 }).success, false);
});
