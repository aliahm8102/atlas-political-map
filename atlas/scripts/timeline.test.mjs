import test from "node:test";
import assert from "node:assert/strict";
import { clampTimelineDate, getTimelineRange, selectedTimelineRange, timelineMonth, timelineMonthValue, timelineTicks, utcMonth, TIMELINE_START_YEAR } from "../lib/timeline.ts";
import { calendarYear, formatCalendarDate, timelineYearsFromCalendar } from "../lib/calendar.ts";
import { monthIndex, validDirectoryRange } from "../lib/directory-filters.ts";
import { settingsSchema } from "../lib/atlas.ts";
import { customPersonSchema } from "../lib/browser-people.ts";
import { parseSearchState, timelineYearFromQuery } from "../lib/search.ts";

test("custom timeline ticks stay in bounds, are ordered and land on both exact endpoints", () => {
  for (const [startYear, endYear] of [[2020, 2020], [1989, 1993], [1848, 2027], [-9998, 9999], [-5, 2], [-100, -98]]) {
    const range = selectedTimelineRange({ startYear, endYear });
    const ticks = timelineTicks(range.min, range.max);
    assert.equal(ticks[0], startYear * 12);
    assert.equal(ticks.at(-1), endYear * 12 + 11);
    assert.ok(ticks.length <= 7 && ticks.every((tick, i) => i === 0 || tick > ticks[i - 1]));
    assert.deepEqual(timelineMonth(ticks.at(-1)), { year: endYear, month: 11 });
    assert.ok(ticks.every(tick => monthIndex(timelineMonthValue(tick)) === tick));
    assert.ok(validDirectoryRange({ from: timelineMonthValue(range.min), to: timelineMonthValue(range.max) }, range));
  }
  const saved = settingsSchema.parse({ year: 2026, month: 11, calendar: "persian", timelineYears: { startYear: -10, endYear: -4 } });
  assert.deepEqual([saved.year, saved.month, saved.calendar], [-4, 11, "persian"]);
  assert.equal(settingsSchema.safeParse({ timelineYears: { startYear: 2001, endYear: 2000 } }).success, false);
});

test("the same Gregorian date converts to each calendar and pre-epoch dates use positive era labels", () => {
  const gregorian = new Date("2024-03-20T00:00:00Z");
  const options = { year: "numeric", month: "long", day: "numeric" };
  assert.equal(formatCalendarDate(gregorian, "en", "gregory", options), "March 20, 2024");
  assert.match(formatCalendarDate(gregorian, "en", "persian", options), /Farvardin 1, 1403/);
  assert.match(formatCalendarDate(gregorian, "en", "islamic-civil", options), /Ramadan 10, 1445/);
  for (const [calendar, date, era] of [
    ["gregory", utcMonth(0), "پیش از میلاد"],
    ["persian", utcMonth(622), "پیش از هجرت"],
    ["islamic-civil", utcMonth(622), "پیش از هجرت"],
  ]) {
    const label = formatCalendarDate(date, "fa", calendar, { year: "numeric" });
    assert.equal(label, `۱ ${era}`);
  }
  assert.match(formatCalendarDate(utcMonth(-40), "fa", "gregory", options), /۴۱.*پیش از میلاد/);
});

test("Hijri year ranges persist Gregorian month boundaries and keep both endpoints in the requested year", () => {
  for (const [calendar, year, first, last] of [
    ["gregory", 2024, "2024-01", "2024-12"],
    ["persian", 1403, "2024-04", "2025-03"],
    ["islamic-civil", 1446, "2024-08", "2025-06"],
  ]) {
    const timelineYears = timelineYearsFromCalendar(year, year, calendar);
    const saved = settingsSchema.parse({ calendar, timelineYears });
    const { min, max } = selectedTimelineRange(saved.timelineYears);
    assert.equal(timelineMonthValue(min), first);
    assert.equal(timelineMonthValue(max), last);
    for (const index of [min, max]) {
      const { year: gregorianYear, month } = timelineMonth(index);
      assert.equal(calendarYear(utcMonth(gregorianYear, month), calendar), year);
    }
  }
  const beforeHijra = timelineYearsFromCalendar(0, 1, "islamic-civil");
  assert.deepEqual(beforeHijra, { startYear: 621, startMonth: 7, endYear: 623, endMonth: 6 });
  assert.equal(timelineYearsFromCalendar(1404, 1403, "persian"), null);
  assert.equal(settingsSchema.safeParse({ timelineYears: { startYear: 2024, startMonth: 8, endYear: 2024, endMonth: 3 } }).success, false);
});

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
