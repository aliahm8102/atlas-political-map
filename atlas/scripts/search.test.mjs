import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { buildSearchIndex, defaultSearchState, normalizeQuery, searchAtlas, alternativeQueries, searchUrl, parseSearchState, editDistance } from "../lib/search.ts";

const people = JSON.parse(fs.readFileSync(new URL("../data/people.json", import.meta.url)));
const countries = JSON.parse(fs.readFileSync(new URL("../data/countries.json", import.meta.url)));
const index = buildSearchIndex(people, countries);
const search = (query, filters = {}) => searchAtlas(index, { ...defaultSearchState, query, ...filters });
const names = (hits) => hits.map(hit => hit.document.name);

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
