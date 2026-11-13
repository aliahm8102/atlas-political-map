import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { geoContains, geoArea } from "d3-geo";
import { bordersAtDate, decodeHistoricalBorders, peopleAtHistoricalBorders } from "../lib/historical-boundaries.ts";
import { countryEntities, countryExistsAt, countryFocusDate, mapDate, periodContains, usesHistoricalBorders } from "../lib/country-entities.ts";
import { countryProfiles, countryProfile } from "../lib/country-profiles.ts";
import { buildSearchIndex, searchAtlas, defaultSearchState } from "../lib/search.ts";

const raw = fs.readFileSync(new URL("../public/boundaries/cshapes-2.0.topojson", import.meta.url));
const topology = JSON.parse(raw), features = decodeHistoricalBorders(topology);
const at = date => bordersAtDate(features, date);
const ids = date => new Set(at(date).map(item => item.id));
const sizes = new Map(features.map(item => [item, geoArea(item)]));

test("all source border changes have exclusive intervals with at most one active version per country identity", () => {
  assert.ok(features.length > 700);
  for (const date of new Set(features.flatMap(item => [item.properties.validFrom, item.properties.validTo]))) {
    const active = at(date);
    assert.equal(new Set(active.map(item => item.id)).size, active.length, `Overlapping versions at ${date}`);
    for (const item of active) {
      assert.ok(countryEntities[item.id]);
      assert.ok(countryExistsAt(String(item.id), date), `${item.id} ${date}`);
      assert.ok(sizes.get(item) > 0 && sizes.get(item) < 6, `Invalid winding for ${item.id}`);
    }
  }
});

test("USSR, Czechoslovakia and Yugoslavia use independent identities with the historical geometry, not a renamed modern outline", () => {
  const historical = at("1980-01-01");
  for (const id of ["hist-ussr", "hist-czechoslovakia", "hist-yugoslavia", "hist-east-germany", "hist-west-germany"]) assert.ok(historical.some(item => item.id === id));
  for (const id of ["643", "804", "203", "703", "191", "705", "276"]) assert.equal(ids("1980-01-01").has(id), false, `Modern state ${id} must not replace its predecessor`);
  const ussr = historical.find(item => item.id === "hist-ussr");
  for (const coordinate of [[37.62,55.75], [30.52,50.45], [69.24,41.3]]) assert.equal(geoContains(ussr, coordinate), true);
  assert.equal(geoContains(historical.find(item => item.id === "hist-czechoslovakia"), [17.11,48.15]), true);
  assert.equal(geoContains(historical.find(item => item.id === "hist-yugoslavia"), [16,45.8]), true);
  assert.ok(ids("2000-01-01").has("643"));
  assert.ok(ids("2000-01-01").has("hist-federal-yugoslavia"));
  assert.ok(ids("2004-01-01").has("hist-serbia-montenegro"));
  assert.equal(ids("1993-01-01").has("hist-czechoslovakia"), false);
  assert.equal(ids("1991-12-26").has("hist-ussr"), false);
  assert.equal(ids("1991-12-25").has("643"), false);
});

test("life dates, search focus and exact annual facts remain separate from border-source coverage", () => {
  assert.equal(countryEntities["hist-ussr"].foundedOn, "1922-12-30");
  assert.equal(countryEntities["hist-ussr"].dissolvedOn, "1991-12-26");
  assert.equal(countryExistsAt("hist-ussr", "2025-01-01"), false);
  assert.equal(countryExistsAt("hist-czechoslovakia", "1918-11-01"), true, "Known founding date is distinct from the first source border observation");
  assert.equal(countryProfile(countryProfiles["hist-ussr"], 2025).flagPath, null);
  assert.deepEqual(countryFocusDate("hist-ussr", 2026, 10), { year: 1991, month: 11 });
  assert.deepEqual(countryFocusDate("hist-ussr", 1900, 0), { year: 1923, month: 0 });
  assert.deepEqual(countryFocusDate("hist-czechoslovakia", 2026, 10), { year: 1992, month: 11 });
  assert.equal(mapDate(1980, 2), "1980-03-01");
  assert.equal(periodContains({ validFrom:"1993-01-01", validTo:"2000-01-01" },"2000-01-01"), false);
  assert.equal(usesHistoricalBorders("2019-12-01"), true);
  assert.equal(usesHistoricalBorders("2020-01-01"), false);
});

test("dated border containment groups historical portraits and country profiles under the same identity", () => {
  const people = [{ id:"test", lat:50.45, lng:30.52, countryCode:"804", country:"Ukraine" }];
  const result = peopleAtHistoricalBorders(people, at("1980-01-01"));
  assert.equal(result[0].countryCode, "hist-ussr");
  assert.equal(result[0].country, "Soviet Union");
  assert.equal(people[0].countryCode, "804", "Imported and private source records are not mutated");
  const index = buildSearchIndex([], Object.values(countryProfiles));
  for (const query of ["USSR", "شوروی", "چکسلواکی", "Yugoslavia"]) assert.ok(searchAtlas(index,{...defaultSearchState,query}).some(hit => hit.document.country?.code.startsWith("hist-")), query);
});

test("bundled boundary data matches its recorded checksum and invalid boundary files fail visibly", () => {
  const provenance = JSON.parse(fs.readFileSync(new URL("../data/historical-boundaries/provenance.json", import.meta.url)));
  assert.equal(createHash("sha256").update(raw).digest("hex"), provenance.outputSha256);
  assert.equal(provenance.license, "CC-BY-NC-SA-4.0");
  assert.throws(() => decodeHistoricalBorders({ type:"FeatureCollection",features:[] }));
  const invalid = structuredClone(topology);
  invalid.objects.countries.geometries[0].properties.validTo = "1900-02-30";
  assert.throws(() => decodeHistoricalBorders(invalid));
});
