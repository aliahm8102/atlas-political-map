import test from "node:test";
import assert from "node:assert/strict";
import { clampTimelineDate, getTimelineRange, TIMELINE_START_YEAR } from "../lib/timeline.ts";
import { settingsSchema } from "../lib/atlas.ts";
import { customPersonSchema } from "../lib/browser-people.ts";
import { parseSearchState, timelineYearFromQuery } from "../lib/search.ts";

test("1848 is available in saved settings, search and character dates while earlier dates remain outside the timeline", () => {
  assert.equal(TIMELINE_START_YEAR, 1848);
  for (const year of [1848, 1890, 1899, 1900]) {
    assert.equal(settingsSchema.safeParse({ year, month: 0 }).success, true);
    assert.equal(parseSearchState(new URLSearchParams({ year: String(year) })).year, String(year));
    assert.equal(timelineYearFromQuery(`Russian Empire ${year}`), String(year));
    assert.deepEqual(clampTimelineDate(year, 0), { year, month: 0 });
  }
  assert.equal(timelineYearFromQuery("روسیه ۱۸۴۸"), "1848");
  assert.equal(timelineYearFromQuery("Russia 1847"), "");
  assert.equal(settingsSchema.safeParse({ year: 1847, month: 11 }).success, false);
  assert.deepEqual(clampTimelineDate(1800, 0), { year: 1848, month: 0 });
  const person = { id: "custom:aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", name: "Historical explorer", title: "Test", role: "leader", lat: 35, lng: 51, countryCode: "364", country: "Iran", region: "Asia", imageUrl: "", startYear: 1848, endYear: 1899, dataset: "custom" };
  assert.equal(customPersonSchema.safeParse(person).success, true);
  assert.equal(customPersonSchema.safeParse({ ...person, startYear: 1847 }).success, false);
});

test("the timeline ends in the same month one calendar year later, including leap years", () => {
  for (const [year, month, day] of [[2028, 1, 29], [2035, 11, 31], [2099, 11, 31], [2100, 0, 1]]) {
    const range = getTimelineRange(new Date(year, month, day, 12));
    assert.equal(range.currentYear, year);
    assert.equal(range.currentMonth, month);
    assert.equal(range.endYear, year + 1);
    assert.equal(range.endMonth, month);
    assert.equal(range.min, TIMELINE_START_YEAR * 12);
    assert.equal(range.max, (year + 1) * 12 + month);
  }
});

test("saved dates, search filters and character dates advance with the clock without reloading modules", context => {
  context.mock.timers.enable({ apis: ["Date"], now: new Date(2035, 10, 18, 12) });
  assert.deepEqual({ year: settingsSchema.parse({}).year, month: settingsSchema.parse({}).month }, { year: 2035, month: 10 });
  assert.equal(settingsSchema.safeParse({ year: 2036, month: 10 }).success, true);
  assert.equal(settingsSchema.safeParse({ year: 2036, month: 11 }).success, false);
  assert.equal(settingsSchema.safeParse({ year: 2037, month: 0 }).success, false);
  assert.equal(settingsSchema.safeParse({ year: 1847, month: 11 }).success, false);
  assert.deepEqual(clampTimelineDate(2040, 11), { year: 2036, month: 10 });
  assert.deepEqual(clampTimelineDate(1847, 11), { year: 1848, month: 0 });
  assert.equal(parseSearchState(new URLSearchParams({ year: "2036" })).year, "2036");
  assert.equal(parseSearchState(new URLSearchParams({ year: "2037" })).year, "");
  assert.equal(parseSearchState(new URLSearchParams({ year: "1847" })).year, "");
  const person = { id: "custom:aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", name: "Future explorer", title: "Test", role: "leader", lat: 35, lng: 51, countryCode: "364", country: "Iran", region: "Asia", imageUrl: "", startYear: 2036, endYear: null, dataset: "custom" };
  assert.equal(customPersonSchema.safeParse(person).success, true);
  assert.equal(customPersonSchema.safeParse({ ...person, startYear: 2037 }).success, false);
  context.mock.timers.setTime(new Date(2036, 0, 1, 12).getTime());
  assert.equal(settingsSchema.parse({}).year, 2036);
  assert.equal(settingsSchema.parse({}).month, 0);
  assert.equal(parseSearchState(new URLSearchParams({ year: "2037" })).year, "2037");
  assert.deepEqual(clampTimelineDate(2040, 11), { year: 2037, month: 0 });
});
