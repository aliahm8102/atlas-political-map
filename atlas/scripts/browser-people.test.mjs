import test from "node:test";
import assert from "node:assert/strict";
import { browserPeopleKey, browserPeopleSchema, customPersonSchema, emptyBrowserPeople, readBrowserPeople, writeBrowserPeople } from "../lib/browser-people.ts";
import { defaultSettings, localStateSchema, visiblePeople } from "../lib/atlas.ts";

const person = { id: "custom:aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", name: "My character", title: "A private description", role: "leader", lat: 35, lng: 51, countryCode: "364", country: "Iran", region: "Asia", imageUrl: "", startYear: null, endYear: null, dataset: "custom" };
const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };

test("characters, portrait positions and custom bookmarks persist only under their account", () => {
  const storage = memory();
  const data = { people: [person], positions: { [person.id]: { x: 600, y: 250 } }, bookmarks: [person.id] };
  writeBrowserPeople(storage, "account-a", data);
  assert.deepEqual(readBrowserPeople(storage, "account-a"), data);
  assert.deepEqual(readBrowserPeople(storage, "account-b"), emptyBrowserPeople);
  writeBrowserPeople(storage, "account-b", emptyBrowserPeople);
  assert.deepEqual(readBrowserPeople(storage, "account-a"), data);
  assert.notEqual(browserPeopleKey("a:b"), browserPeopleKey("a%3Ab"));
});
test("failed browser writes report failure without replacing persisted data", () => {
  const storage = memory();
  writeBrowserPeople(storage, "account-a", { ...emptyBrowserPeople, people: [person] });
  const blocked = { getItem: storage.getItem, setItem: () => { throw new Error("QuotaExceededError"); } };
  assert.throws(() => writeBrowserPeople(blocked, "account-a", emptyBrowserPeople));
  assert.equal(readBrowserPeople(storage, "account-a").people.length, 1);
});
test("invalid coordinates, unsafe portraits, reversed terms and excessive collections are rejected", () => {
  for (const patch of [{ lat: 91 }, { lng: Infinity }, { imageUrl: "javascript:alert(1)" }, { imageUrl: "data:image/svg+xml;base64,AAAA" }, { startYear: 2025, endYear: 2024 }, { name: "   " }]) assert.equal(customPersonSchema.safeParse({ ...person, ...patch }).success, false);
  assert.equal(browserPeopleSchema.safeParse({ ...emptyBrowserPeople, positions: { p: { x: -1, y: 50 } } }).success, false);
  assert.equal(browserPeopleSchema.safeParse({ ...emptyBrowserPeople, people: Array(201).fill(person) }).success, false);
});
test("custom people follow the same date, role, region and search filters", () => {
  assert.equal(visiblePeople([person], defaultSettings).length, 1);
  assert.equal(visiblePeople([{ ...person, startYear: 2000, endYear: 2020 }], defaultSettings).length, 0);
  assert.equal(visiblePeople([person], { ...defaultSettings, roles: ["army"] }).length, 0);
  assert.equal(visiblePeople([person], { ...defaultSettings, region: "Europe" }).length, 0);
  assert.equal(visiblePeople([person], defaultSettings, "private").length, 1);
});
test("legacy personal storage drops retired views while keeping notes, profile and bookmarks", () => {
  const parsed = localStateSchema.parse({ settings: defaultSettings, displayName: "Existing user", bookmarks: ["kept"], notes: { "364": "Keep this note" }, views: [{ obsolete: true }] });
  assert.equal(Object.hasOwn(parsed, "views"), false);
  assert.equal(parsed.notes["364"], "Keep this note");
  assert.deepEqual(parsed.bookmarks, ["kept"]);
});
