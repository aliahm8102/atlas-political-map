import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { countryProfile, countryProfiles, withCountryProfiles } from "../lib/country-profiles.ts";
import { createTranslator } from "../lib/i18n/index.ts";
import { mapResultHref, mapTargetId, parseMapTarget } from "../lib/map-links.ts";

const read = file => JSON.parse(fs.readFileSync(new URL(file, import.meta.url)));
const countries = read("../data/countries.json"), samples = read("../data/source/country-profile-samples.json");
test("all 44 supplied country samples retain exact names, capitals, areas and populations", () => {
  assert.equal(samples.length, 44);
  for (const [code, nameFa, nameEn, capitalFa, areaKm2, population] of samples) {
    const profile = countryProfile(countryProfiles[code], 2025);
    assert.deepEqual([profile.nameFa, profile.nameEn, profile.capitalFa, profile.areaKm2, profile.population], [nameFa, nameEn, capitalFa, areaKm2, population]);
    assert.equal(createTranslator("fa").countryName(profile.name), nameFa);
  }
  assert.equal(countryProfile(countryProfiles["336"], 2025).areaKm2, .49);
});
test("country coverage includes small sample countries without duplicating existing map identities", () => {
  const merged = withCountryProfiles(countries);
  assert.equal(merged.length, Object.keys(countryProfiles).length);
  assert.equal(new Set(merged.map(country => country.code)).size, merged.length);
  assert.deepEqual(withCountryProfiles(merged), merged);
  for (const name of ["Andorra", "Liechtenstein", "Malta", "Monaco", "San Marino"]) assert.ok(merged.some(country => country.name === name));
  for (const country of countries) assert.equal(merged.find(item => item.code === country.code), country);
});
test("every profile has a safe local flag and Persian name; absent facts remain explicitly unavailable", () => {
  for (const metadata of Object.values(countryProfiles)) {
    const profile = countryProfile(metadata, 2025);
    assert.match(profile.nameFa, /[\u0600-\u06ff]/);
    if (profile.flagPath !== null) {
      assert.match(profile.flagPath, /^\/flags\/[a-z0-9-]+\.svg$/);
      const flag = fs.readFileSync(new URL(`../public${profile.flagPath}`, import.meta.url), "utf8");
      assert.match(flag, /<svg/); assert.doesNotMatch(flag, /<script\b|<foreignObject\b|\bonload\s*=/i);
    }
    assert.ok(profile.areaKm2 === null || profile.areaKm2 >= 0);
    assert.ok(profile.population === null || Number.isSafeInteger(profile.population));
  }
  assert.equal(countryProfile(countryProfiles["ne-somaliland"], 2025).population, null);
  assert.equal(countryProfile({ code: "missing", name: "New country" }, 2025).capitalEn, null);
});
test("person and country map links round trip safely, including custom identities", () => {
  for (const target of [{ kind: "country", id: "276" }, { kind: "country", id: "ne-kosovo" }, { kind: "person", id: "custom:aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }]) assert.deepEqual(parseMapTarget(`#${mapTargetId(target)}`), target);
  assert.equal(mapResultHref({ country: { code: "276" } }), "/workspace#country-276");
  assert.match(mapResultHref({ person: { id: "custom:a" } }), /#person-custom%3Aa$/);
  for (const hash of ["#country-%", "#person-%3Cscript%3E", "#country-../../", "#unknown-276"]) assert.equal(parseMapTarget(hash), null);
});
