import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createTranslator, resolveLocale, authErrorKey, normalizeSearch } from "../lib/i18n/index.ts";

const people = JSON.parse(fs.readFileSync(new URL("../data/people.json", import.meta.url)));
const countries = JSON.parse(fs.readFileSync(new URL("../data/countries.json", import.meta.url)));

test("Persian is the default regardless of browser language; explicit choices are preserved", () => {
  assert.equal(resolveLocale(), "fa");
  assert.equal(resolveLocale(undefined, "en-US,en;q=0.9"), "fa");
  assert.equal(resolveLocale("", "en-US"), "fa");
  assert.equal(resolveLocale("<invalid>", "de-DE"), "fa");
  assert.equal(resolveLocale("en"), "en");
  assert.equal(resolveLocale("fa"), "fa");
  assert.equal(createTranslator("fa").t("My Atlas"), "اطلس من");
});

test("Persian content covers every bundled country, person, and office title while preserving English source data", () => {
  const fa = createTranslator("fa");
  const en = createTranslator("en");
  for (const country of countries) assert.match(fa.countryName(country.name), /[\u0600-\u06ff]/, country.name);
  for (const person of people) {
    assert.match(fa.personName(person.name), /[\u0600-\u06ff]/, person.name);
    assert.match(fa.personTitle(person.title), /[\u0600-\u06ff]/, person.title);
    assert.equal(en.personName(person.name), person.name);
    assert.equal(en.personTitle(person.title), person.title);
  }
});

test("Persian numbers, Gregorian dates, dynamic labels, and errors stay localized", () => {
  const { t, n, date, periodLabel } = createTranslator("fa");
  assert.equal(n(2026, { useGrouping: false }), "۲۰۲۶");
  assert.match(date(new Date("2026-10-01T00:00:00Z")), /۲۰۲۶/);
  assert.doesNotMatch(date(new Date("2026-10-01T00:00:00Z")), /۱۴۰۵/);
  assert.equal(t("View {name} on the map", { name: "مسعود پزشکیان" }), "دیدن مسعود پزشکیان روی نقشه");
  assert.match(periodLabel({ startYear: 2024, endYear: null }), /۲۰۲۴.*بدون تاریخ پایان/);
  assert.equal(t(authErrorKey({ code: "invalid_credentials" })), "ایمیل یا رمز عبور نادرست است.");
  assert.equal(t(authErrorKey(new Error("Incorrect email or password."))), "ایمیل یا رمز عبور نادرست است.");
});

test("search finds Persian names and countries, keeps English aliases, and normalizes Arabic characters", () => {
  const { matchesPerson } = createTranslator("fa");
  const person = people.find(p => p.name === "Masoud Pezeshkian");
  assert.equal(matchesPerson(person, "پزشکیان"), true);
  assert.equal(matchesPerson(person, "پزشكيان"), true);
  assert.equal(matchesPerson(person, "Iran"), true);
  assert.equal(matchesPerson(person, "ایران"), true);
  assert.equal(matchesPerson(person, "روسیه"), false);
  assert.equal(normalizeSearch("خامنه‌ای"), normalizeSearch("خامنه اي"));
});
