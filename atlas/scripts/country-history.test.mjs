import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { countryHistorySchema, countryYear, emptyCountryYear } from "../lib/country-history.ts";
import { countryHistories, countryProfile, countryProfiles } from "../lib/country-profiles.ts";
import { countryHistoryIndex, historyDirectory } from "./index-country-histories.mjs";
import { createTranslator } from "../lib/i18n/index.ts";

const facts = { capitalFa: "برلین", capitalEn: "Berlin", areaKm2: 357022, population: 83491249, flagPath: "/flags/de.svg" };

test("country facts, capitals and flags come only from the selected year, never from a future or earlier snapshot", () => {
  const earlier = { ...facts, capitalFa: "بن", capitalEn: "Bonn", areaKm2: 248577, population: 62000000, flagPath: "/flags/history/de-1989.svg" };
  // Synthetic annual records exercise the model; these are not published historical data.
  const history = countryHistorySchema.parse({ code: "276", years: { "2025": facts, "1989": earlier, "1990": emptyCountryYear } });
  assert.deepEqual(countryYear(history, 1989), earlier);
  assert.deepEqual(countryYear(history, 2025), facts);
  assert.deepEqual(countryYear(history, 1990), emptyCountryYear);
  for (const year of [1900, 1988, 2000, 2024, 2026, 2025.5, Infinity, NaN]) assert.equal(countryYear(history, year), null);
  assert.equal(countryYear(undefined, 2025), null);
});

test("every catalog country has its own validated file and a 2025 seed; the generated index stays current", async () => {
  const codes = Object.keys(countryProfiles).sort();
  assert.ok(codes.length >= 183);
  assert.deepEqual(Object.keys(countryHistories).sort(), codes);
  assert.equal((await fs.readFile(new URL("../data/country-history/index.ts", import.meta.url), "utf8")).replace(/\r\n/g, "\n"), await countryHistoryIndex());
  for (const code of codes) {
    const file = JSON.parse(await fs.readFile(`${historyDirectory}/${code}.json`, "utf8"));
    assert.equal(file.code, code);
    assert.deepEqual(countryHistorySchema.parse(file), countryHistories[code]);
    if (file.years["2025"]) assert.deepEqual(Object.keys(file.years["2025"]).sort(), Object.keys(facts).sort());
    assert.equal(Object.hasOwn(countryProfiles[code], "population"), false, "Metadata must not carry timeless annual facts");
    const missing = countryProfile(countryProfiles[code], 2024);
    assert.equal(missing.dataYear, null);
    for (const field of Object.keys(facts)) assert.equal(missing[field], null, `${code}: missing ${field}`);
  }
  const template = JSON.parse(await fs.readFile(new URL("../data/country-history/template.json", import.meta.url), "utf8"));
  assert.deepEqual(countryHistorySchema.parse(template).years["2025"], emptyCountryYear);
  assert.equal(Object.hasOwn(countryHistories, "template"), false);
});

test("manual annual records reject invalid numbers, unsafe flags, mixed languages, missing fields and misspelled years", () => {
  const parse = value => countryHistorySchema.safeParse({ code: "276", years: { "2025": value } }).success;
  assert.equal(parse(facts), true);
  assert.equal(parse(emptyCountryYear), true);
  for (const patch of [{ population: -1 }, { population: 1.5 }, { population: "83,491,249" }, { areaKm2: Infinity }, { areaKm2: -1 }, { capitalFa: "Berlin" }, { capitalEn: "برلین" }, { flagPath: "javascript:alert(1)" }, { flagPath: "/flags/../private.svg" }, { flagPath: "https://untrusted.test/flag.svg" }, { flagPath: "/flags/flag.svg?x=1" }, { unknown: true }]) assert.equal(parse({ ...facts, ...patch }), false, JSON.stringify(patch));
  const incomplete = { ...facts };
  delete incomplete.population;
  assert.equal(parse(incomplete), false);
  assert.equal(countryHistorySchema.safeParse({ code: "276", years: { "2025-old": facts } }).success, false);
  assert.equal(countryHistorySchema.safeParse({ code: "276", years: {} }).success, true);
});

test("country names use only the requested language for both original aliases and translated names", () => {
  const fa = createTranslator("fa"), en = createTranslator("en");
  for (const profile of Object.values(countryProfiles)) {
    for (const name of [profile.name, profile.nameEn, profile.nameFa]) {
      assert.equal(fa.countryName(name), profile.nameFa);
      assert.equal(en.countryName(name), profile.nameEn);
    }
    const year = countryProfile(profile, 2025);
    assert.ok(year.capitalFa === null || /[\u0600-\u06ff]/.test(year.capitalFa) && !/[a-z]/i.test(year.capitalFa));
  }
});
