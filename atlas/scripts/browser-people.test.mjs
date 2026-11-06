import test from "node:test";
import assert from "node:assert/strict";
import { browserPeopleKey, browserPeopleSchema, customPersonSchema, emptyBrowserPeople, readBrowserPeople, writeBrowserPeople, updateBrowserPerson, removeBrowserPerson, reconcilePublications } from "../lib/browser-people.ts";
import { defaultSettings, localStateSchema, visiblePeople } from "../lib/atlas.ts";

const person = { id: "custom:aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", name: "My character", title: "A private description", role: "leader", lat: 35, lng: 51, countryCode: "364", country: "Iran", region: "Asia", imageUrl: "", startYear: null, endYear: null, dataset: "custom" };
const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };

test("characters, portrait positions and custom bookmarks persist only under their account", () => {
  const storage = memory();
  const data = { ...emptyBrowserPeople, people: [person], positions: { [person.id]: { x: 600, y: 250 } }, bookmarks: [person.id] };
  writeBrowserPeople(storage, "account-a", data);
  assert.deepEqual(readBrowserPeople(storage, "account-a"), data);
  assert.deepEqual(readBrowserPeople(storage, "account-b"), emptyBrowserPeople);
  writeBrowserPeople(storage, "account-b", emptyBrowserPeople);
  assert.deepEqual(readBrowserPeople(storage, "account-a"), data);
  assert.notEqual(browserPeopleKey("a:b"), browserPeopleKey("a%3Ab"));
});

test("legacy storage restores tags/groups without dropping existing drafts", () => {
  const parsed = browserPeopleSchema.parse({ people: [person], positions: {}, bookmarks: [] });
  assert.deepEqual(parsed.tags, {}); assert.deepEqual(parsed.groups, []);
  assert.equal(parsed.people[0].id, person.id);
});

test("ordinary draft edits preserve identity, bookmarks, positions and organization", () => {
  const storage = memory();
  const original = { ...emptyBrowserPeople, people: [person], positions: { [person.id]: { x: 600, y: 250 } }, bookmarks: [person.id], tags: { [person.id]: ["منتخب", "Review"] }, groups: [{ id: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb", name: "My group", personIds: [person.id] }] };
  writeBrowserPeople(storage, "a", original);
  const edited = updateBrowserPerson(readBrowserPeople(storage, "a"), { ...person, name: "Edited", nameFa: "ویرایش شده", titleFa: "توضیح فارسی" });
  writeBrowserPeople(storage, "a", edited);
  assert.equal(readBrowserPeople(storage, "a").people[0].nameFa, "ویرایش شده");
  assert.equal(edited.people.length, 1); assert.deepEqual(edited.groups, original.groups); assert.deepEqual(edited.positions, original.positions); assert.deepEqual(edited.bookmarks, original.bookmarks);
  assert.deepEqual(readBrowserPeople(storage, "b"), emptyBrowserPeople);
  assert.throws(() => updateBrowserPerson(emptyBrowserPeople, person));
  const deleted = removeBrowserPerson(edited, person.id);
  assert.deepEqual(deleted.tags, {}); assert.deepEqual(deleted.groups[0].personIds, []);
});

test("only approval removes a draft and remaps its personal references exactly once", () => {
  const data = { ...emptyBrowserPeople, people: [person], bookmarks: [person.id], positions: { [person.id]: { x: 600, y: 250 } }, tags: { [person.id]: ["Tag"], shared: ["Existing"] }, groups: [{ id: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb", name: "Group", personIds: [person.id, "shared"] }] };
  const publication = { id: "request", localId: person.id.slice(7), status: "approved", reviewNote: "", personId: "shared" };
  for (const status of ["pending", "rejected"]) assert.equal(reconcilePublications(data, [{ ...publication, status }]), data);
  const result = reconcilePublications(data, [publication]);
  assert.deepEqual(result.people, []); assert.deepEqual(result.bookmarks, ["shared"]);
  assert.deepEqual(result.positions, { shared: { x: 600, y: 250 } });
  assert.deepEqual(result.tags, { shared: ["Existing", "Tag"] });
  assert.deepEqual(result.groups[0].personIds, ["shared"]);
  assert.equal(reconcilePublications(result, [publication]), result);
  const removed = reconcilePublications(data, [{ ...publication, personId: null }]);
  assert.deepEqual(removed.people, []); assert.deepEqual(removed.bookmarks, []); assert.deepEqual(removed.groups[0].personIds, ["shared"]);
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
