import { MAX_TIMELINE_YEAR, MIN_TIMELINE_YEAR, timelineMonth, timelineMonthDate } from "./timeline.ts";

export const calendarLabels = {
  gregory: "Gregorian calendar",
  persian: "Solar Hijri calendar",
  "islamic-civil": "Lunar Hijri calendar",
} as const;
export type AtlasCalendar = keyof typeof calendarLabels;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(locale: string, calendar: AtlasCalendar, options: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify([locale, calendar, options]);
  let value = formatters.get(key);
  if (!value) {
    value = new Intl.DateTimeFormat(locale, { ...options, calendar, timeZone: "UTC" });
    formatters.set(key, value);
  }
  return value;
}

export function calendarYear(value: Date, calendar: AtlasCalendar) {
  return calendar === "gregory" ? value.getUTCFullYear()
    : Number(formatter("en-US-u-nu-latn", calendar, { year: "numeric" }).formatToParts(value).find(part => part.type === "year")?.value);
}

export function timelineYearsFromCalendar(start: number, end: number, calendar: AtlasCalendar) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) return null;
  const min = MIN_TIMELINE_YEAR * 12, max = MAX_TIMELINE_YEAR * 12 + 11;
  const yearAt = (index: number) => calendarYear(timelineMonthDate(index), calendar);
  if (start < yearAt(min) || end > yearAt(max)) return null;

  // Find the first Gregorian month sample on or after the calendar's new year.
  function firstMonth(year: number) {
    let low = min, high = max + 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (yearAt(middle) < year) low = middle + 1;
      else high = middle;
    }
    return low;
  }
  const from = timelineMonth(firstMonth(start)), to = timelineMonth(firstMonth(end + 1) - 1);
  return { startYear: from.year, startMonth: from.month, endYear: to.year, endMonth: to.month };
}

export function formatCalendarDate(value: Date, locale: "en" | "fa", calendar: AtlasCalendar, options: Intl.DateTimeFormatOptions) {
  const intlLocale = locale === "fa" ? "fa-IR" : "en-US";
  const year = calendarYear(value, calendar);
  const format = formatter(intlLocale, calendar, options);
  if (year >= 1 || !options.year) return format.format(value);
  const era = calendar === "gregory"
    ? (locale === "fa" ? "پیش از میلاد" : "BC")
    : (locale === "fa" ? "پیش از هجرت" : "Before Hijra");
  const body = format.formatToParts(value).filter(part => part.type !== "era").map(part => {
    if (part.type !== "year" || calendar === "gregory") return part.value;
    return new Intl.NumberFormat(intlLocale, { useGrouping: false }).format(1 - year);
  }).join("").trim();
  return `${body} ${era}`;
}
