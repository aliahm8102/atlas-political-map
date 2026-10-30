import { addYears, getMonth, getYear } from "date-fns";

export const TIMELINE_START_YEAR = 1900;

export function getTimelineRange(now = new Date()) {
  const end = addYears(now, 1);
  const currentYear = getYear(now), currentMonth = getMonth(now);
  const endYear = getYear(end), endMonth = getMonth(end);
  return { currentYear, currentMonth, endYear, endMonth, min: TIMELINE_START_YEAR * 12, max: endYear * 12 + endMonth };
}

export function clampTimelineDate(year: number, month: number) {
  const { min, max } = getTimelineRange();
  const value = Math.max(min, Math.min(max, year * 12 + month));
  return { year: Math.floor(value / 12), month: value % 12 };
}
