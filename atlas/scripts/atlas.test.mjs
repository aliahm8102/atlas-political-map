import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { visiblePeople, defaultSettings, settingsSchema, localStateSchema, viewportSchema, zoomViewport, defaultViewport, MAX_MAP_ZOOM } from "../lib/atlas.ts";
import { getTimelineRange } from "../lib/timeline.ts";
import { buildPersonProfiles, personProfileId, profilePeople, uniquePeople } from "../lib/person-profiles.ts";
import { buildSearchIndex, defaultSearchState, searchAtlas } from "../lib/search.ts";
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
test("Trump has one profile with two independently searchable terms", () => {
  const sourceTerms = people.filter(person => person.name === "Donald Trump");
  const profiles = buildPersonProfiles(people);
  assert.equal(profiles.size, people.length - 1);
  const id = personProfileId(sourceTerms[0].id);
  assert.equal(personProfileId(sourceTerms[1].id), id);
  const profile = profiles.get(id);
  assert.equal(profile.name, "Donald Trump");
  assert.equal(profile.imageUrl, sourceTerms[0].imageUrl);
  assert.deepEqual(profile.terms.map(term => [term.startYear, term.endYear]), [[2025, null], [2017, 2021]]);
  assert.equal(uniquePeople(profilePeople(profile)).length, 1);
  const index = buildSearchIndex(profilePeople(profile), []);
  const search = year => searchAtlas(index, { ...defaultSearchState, query: "Donald Trump", year });
  assert.equal(search("").length, 1);
  assert.equal(search("2018")[0].document.person.startYear, 2017);
  assert.equal(search("2025")[0].document.person.startYear, 2025);
  assert.equal(search("2023").length, 0);
  assert.equal(visiblePeople(profilePeople(profile), { ...defaultSettings, year: 2023, month: 0 }).length, 0);
  assert.equal(buildPersonProfiles([...sourceTerms, { ...sourceTerms[0], id: "another-person" }]).size, 2);
});
test("historical selection, role, region, and search all narrow the collection", () => {
  const history = visiblePeople(people, { ...defaultSettings, year: 1942, month: 0 });
  assert.ok(history.some(p => p.name === "Sir Winston Churchill"));
  assert.ok(!history.some(p => p.name === "Keir Starmer"));
  const filtered = visiblePeople(people, { ...defaultSettings, mapRegions: ["Asia"], roles: ["leader"] }, "India");
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every(p => p.region === "Asia" && p.role === "leader" && p.country === "India"));
  assert.equal(visiblePeople(people, { ...defaultSettings, roles: [] }).length, 0);
});
test("saved preferences accept December and reject corrupt or out-of-range state", () => {
  assert.equal(settingsSchema.parse({ month: 11 }).month, 11);
  assert.equal(settingsSchema.safeParse({ month: 12 }).success, false);
  assert.equal(settingsSchema.safeParse({ year: getTimelineRange().endYear + 1 }).success, false);
  assert.equal(localStateSchema.safeParse({ settings: { theme: "untrusted" } }).success, false);
});

test("continent selections migrate, persist and filter independently with an empty selection hiding everyone", () => {
  assert.equal(settingsSchema.parse({}).mapRegions.length,6);
  assert.deepEqual(settingsSchema.parse({region: "Asia"}).mapRegions,["Asia"]);
  const settings = settingsSchema.parse({mapRegions: ["Europe", "Asia"], year: 2025, month: 0});
  const filtered = visiblePeople(people,settings);
  assert.ok(filtered.some(person=>person.region==="Europe"));
  assert.ok(filtered.some(person=>person.region==="Asia"));
  assert.ok(filtered.every(person=>["Europe","Asia"].includes(person.region)));
  for(const mapRegions of [["Europe","Asia"],[]]) {
    const restored=localStateSchema.parse(JSON.parse(JSON.stringify({settings:{...settings,mapRegions}})));
    assert.deepEqual(restored.settings.mapRegions,mapRegions);
  }
  assert.deepEqual(visiblePeople(people,{...settings,mapRegions:[]}),[]);
  assert.equal(settingsSchema.safeParse({mapRegions:["All regions"]}).success,false);
});

test("appearance preferences preserve new options and restore legacy settings with default text size", () => {
  const legacy = settingsSchema.parse({ theme: "dark", accent: "lavender", year: 1942 });
  assert.equal(legacy.fontSize, 100);
  assert.equal(legacy.year, 1942);
  for (const theme of ["light", "dark", "sand", "midnight"]) {
    for (const accent of ["sage", "blue", "lavender", "amber", "rose"]) {
      const saved = { ...defaultSettings, theme, accent, fontSize: 130 };
      const restored = localStateSchema.parse(JSON.parse(JSON.stringify({ settings: saved, bookmarks: ["kept"], displayName: "Explorer" })));
      assert.deepEqual(restored.settings, saved);
      assert.deepEqual(restored.bookmarks, ["kept"]);
    }
  }
  for (const fontSize of [89, 131, 100.5, "120", null]) assert.equal(settingsSchema.safeParse({ fontSize }).success, false);
  assert.equal(settingsSchema.parse({ fontSize: 90 }).fontSize, 90);
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
test("viewport validation retains deep zoom without accepting invalid scales", () => {
  assert.equal(viewportSchema.parse(zoomViewport(defaultViewport, 64)).k, 64);
  assert.equal(viewportSchema.safeParse({ x: 0, y: 0, k: 65 }).success, false);
  assert.equal(viewportSchema.safeParse({ x: 0, y: 0, k: .5 }).success, false);
});
