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

export function formatCalendarDate(value: Date, locale: "en" | "fa", calendar: AtlasCalendar, options: Intl.DateTimeFormatOptions) {
  const intlLocale = locale === "fa" ? "fa-IR" : "en-US";
  const year = calendar === "gregory" ? value.getUTCFullYear()
    : Number(formatter("en-US-u-nu-latn", calendar, { year: "numeric" }).formatToParts(value).find(part => part.type === "year")?.value);
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
