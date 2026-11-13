import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { buildSearchIndex, defaultSearchState, normalizeQuery, searchAtlas, alternativeQueries, searchUrl, parseSearchState, editDistance, searchPreviews } from "../lib/search.ts";

const people = JSON.parse(fs.readFileSync(new URL("../data/people.json", import.meta.url)));
const countries = JSON.parse(fs.readFileSync(new URL("../data/countries.json", import.meta.url)));
const index = buildSearchIndex(people, countries);
const search = (query, filters = {}) => searchAtlas(index, { ...defaultSearchState, query, ...filters });
const names = (hits) => hits.map(hit => hit.document.name);

test("previews cap each matching type at three and retain full counts and real hrefs", () => {
  const persons = Array.from({ length: 5 }, (_, i) => ({ ...people[0], id: `preview-${i}`, name: `Atlas person ${i}` }));
  const places = Array.from({ length: 5 }, (_, i) => ({ ...countries[0], code: `preview-${i}`, name: `Atlas country ${i}` }));
  const organization = { tags: { [persons[0].id]: Array.from({ length: 5 }, (_, i) => `Atlas tag ${i}`) }, groups: Array.from({ length: 5 }, (_, i) => ({ id: `group-${i}`, name: `Atlas group ${i}`, personIds: [persons[0].id] })) };
  const sections = searchPreviews(buildSearchIndex(persons, places, organization), "Atlas", organization, "en");
  assert.deepEqual(sections.map(section => section.type).sort(), ["group", "person", "place", "tag"]);
  for (const section of sections) { assert.equal(section.items.length, 3); assert.equal(section.total, 5); assert.ok(section.items.every(item => item.href.startsWith("/workspace"))); }
  assert.deepEqual(searchPreviews(index, "", organization, "fa"), []);
});

test("tag/group preview filters round trip and restrict results to exact membership", () => {
  const organization = { tags: { [people[0].id]: ["My tag"] }, groups: [{ id: "group-one", name: "My group", personIds: [people[1].id] }] };
  const personal = buildSearchIndex(people, countries, organization);
  for (const [key, value, person] of [["tag", "My tag", people[0]], ["group", "group-one", people[1]]]) {
    const state = { ...defaultSearchState, type: "person", [key]: value };
    assert.deepEqual(parseSearchState(new URL(searchUrl(state), "https://atlas.test").searchParams), state);
    assert.deepEqual(searchAtlas(personal, state).map(hit => hit.document.person.id), [person.id]);
    assert.deepEqual(searchAtlas(index, state), []);
  }
});

test("private tag and group searches use only the supplied account's current metadata", () => {
  const person = people[0];
  const organization = { tags: { [person.id]: ["قفقازشخصی"] }, groups: [{ id: "private", name: "CollectorsPrivate", personIds: [person.id] }] };
  const personal = buildSearchIndex(people, countries, organization);
  for (const query of ["قفقازشخصی", "CollectorsPrivate"]) {
    assert.equal(searchAtlas(personal, { ...defaultSearchState, query })[0]?.document.person?.id, person.id);
    assert.equal(searchAtlas(index, { ...defaultSearchState, query }).length, 0, "Other accounts do not inherit private metadata");
  }
  const edited = buildSearchIndex(people, countries, { tags: {}, groups: [] });
  assert.equal(searchAtlas(edited, { ...defaultSearchState, query: "CollectorsPrivate" }).length, 0);
});

test("user-authored bilingual names and descriptions are searchable in both languages", () => {
  const person = { ...people[0], id: "custom:bilingual", name: "Private explorer", title: "Independent researcher", nameFa: "کاوشگر شخصی", titleFa: "پژوهشگر مستقل" };
  const bilingual = buildSearchIndex([person], []);
  for (const query of ["Private explorer", "کاوشگر شخصی", "Independent researcher", "پژوهشگر مستقل"]) {
    assert.equal(searchAtlas(bilingual, { ...defaultSearchState, query })[0]?.document.person?.id, person.id, query);
  }
});

test("people and countries share a ranked index, including records outside the current map date", () => {
  assert.equal(index.length, people.length + countries.length);
  assert.equal(search("Iran")[0].document.country.name, "Iran");
  assert.ok(names(search("Obama")).includes("Barack Obama"));
  assert.ok(search("Iran").some(hit => hit.document.person));
  assert.ok(search("Iran", { type: "place" }).every(hit => hit.document.type === "place"));
});

test("Persian Arabic letters, marks, half spaces, plural forms and Latin accents normalize", () => {
  assert.equal(normalizeQuery("  إِيران ۲۰۲۴  "), "ایران 2024");
  assert.ok(names(search("پزشكيان")).includes("Masoud Pezeshkian"));
  assert.ok(names(search("رئیس‌جمهورهای ایران")).includes("Masoud Pezeshkian"));
  assert.equal(names(search("Iran"))[0], names(search("ایران"))[0]);
  assert.equal(normalizeQuery("Türkiye"), "turkiye");
});

test("domain intent and synonyms understand role, country and year in both languages", () => {
  for (const query of ["presidents of Iran in 2024", "روسای جمهور ایران در سال ۲۰۲۴"]) {
    const hits = search(query);
    assert.ok(hits.length > 0, query);
    assert.ok(names(hits).includes("Masoud Pezeshkian"), query);
    assert.ok(hits.every(hit => hit.document.person?.country === "Iran"));
  }
  const military = search("army Iran");
  assert.ok(military.length > 0);
  assert.deepEqual(names(military).sort(), names(search("نظامیان ایرانی")).sort());
  assert.ok(military.every(hit => hit.document.person?.country === "Iran"));
  assert.equal(search("USA")[0].document.country.name, "United States of America");
  assert.equal(search("بریتانیا")[0].document.country.name, "United Kingdom");
  assert.ok(search("European countries").every(hit => hit.document.region === "Europe"));
});

test("typos and adjacent transpositions recover names without polluting exact country matches", () => {
  assert.equal(editDistance("irna", "iran"), 1);
  assert.ok(names(search("barak obma")).includes("Barack Obama"));
  assert.ok(names(search("irna")).includes("Iran"));
  assert.ok(search("irna").some(hit => hit.approximate));
  assert.equal(search("Iran", { type: "place" }).some(hit => hit.document.name === "Iraq"), false);
  assert.deepEqual(search("zzzzzzzzzzzzzzzzzzzzzzzz"), []);
});

test("filters combine, zero-result recovery suggests alternatives, and sorting is deterministic", () => {
  const hits = search("", { type: "person", region: "Asia", role: "army", year: "2024" });
  assert.ok(hits.length > 0);
  assert.ok(hits.every(hit => hit.document.person.role === "army" && hit.document.region === "Asia"));
  assert.deepEqual(search("Iran", { region: "Europe" }), []);
  assert.ok(alternativeQueries(index, "Obamaxx", "en").includes("Barack Obama"));
  const alphabetical = names(search("", { type: "place", sort: "name" }));
  assert.deepEqual(alphabetical, [...alphabetical].sort((a, b) => a.localeCompare(b, "en")));
  const recent = search("", { type: "person", sort: "newest" }).map(hit => hit.document.person.startYear);
  for (let i = 1; i < recent.length; i++) assert.ok((recent[i - 1] ?? -Infinity) >= (recent[i] ?? -Infinity));
});

test("query and filters round trip in URLs; malformed parameters are bounded or rejected", () => {
  const state = { ...defaultSearchState, query: "رئیس جمهور ایران", type: "person", year: "2024", region: "Asia", role: "member", sort: "name" };
  assert.deepEqual(parseSearchState(new URL(searchUrl(state), "https://atlas.test").searchParams), state);
  const invalid = parseSearchState(new URLSearchParams({ q: "a".repeat(1000), type: "bad", role: "admin", region: "invalid", year: "xyz", sort: "random" }));
  assert.equal(invalid.query.length, 160);
  assert.equal(invalid.role, ""); assert.equal(invalid.region, ""); assert.equal(invalid.year, "");
  assert.equal(invalid.type, "all"); assert.equal(invalid.sort, "relevance");
});

test("full English country names remain searchable alongside imported map aliases", () => {
  assert.equal(search("North Macedonia", { type: "place" })[0]?.document.country.code, "807");
  assert.equal(search("Bosnia and Herzegovina", { type: "place" })[0]?.document.country.code, "070");
});

test("account-local characters join only the supplied account index and untrusted text remains data", () => {
  const custom = { ...people[0], id: "custom:test", name: "<script>My explorer</script>", title: "My private character", dataset: "custom" };
  const own = buildSearchIndex([...people, custom], countries);
  assert.ok(searchAtlas(own, { ...defaultSearchState, query: "My explorer" }).some(hit => hit.document.person?.id === custom.id));
  assert.equal(search("My explorer").length, 0);
});

test("representative queries complete interactively on the bundled index", () => {
  const start = performance.now();
  for (const query of ["Iran", "barak obma", "روسای جمهور ایران", "zzzzzzzzz", "نظامیان", "USA"]) search(query);
  assert.ok(performance.now() - start < 2000);
});
