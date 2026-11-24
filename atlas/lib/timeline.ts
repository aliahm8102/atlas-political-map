import { addYears, getMonth, getYear } from "date-fns";

export const TIMELINE_START_YEAR = 1848;
export const MIN_TIMELINE_YEAR = -9998;
export const MAX_TIMELINE_YEAR = 9999;
export type TimelineYears = { startYear: number; endYear: number; startMonth?: number; endMonth?: number };
export type TimelineBounds = { min: number; max: number };

export function getTimelineRange(now = new Date()) {
  const end = addYears(now, 1);
  const currentYear = getYear(now), currentMonth = getMonth(now);
  const endYear = getYear(end), endMonth = getMonth(end);
  return { currentYear, currentMonth, endYear, endMonth, min: TIMELINE_START_YEAR * 12, max: endYear * 12 + endMonth };
}

export function selectedTimelineRange(years?: TimelineYears | null, now = new Date()) {
  const defaults = getTimelineRange(now);
  return years ? { ...defaults, min: years.startYear * 12 + (years.startMonth ?? 0), max: years.endYear * 12 + (years.endMonth ?? 11) } : defaults;
}

export function timelineMonth(index: number) {
  const year = Math.floor(index / 12);
  return { year, month: index - year * 12 };
}

export function clampTimelineDate(year: number, month: number, { min, max }: TimelineBounds = getTimelineRange()) {
  const value = Math.max(min, Math.min(max, year * 12 + month));
  return timelineMonth(value);
}

export function utcMonth(year: number, month = 0) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, 1);
  return date;
}

export function timelineMonthDate(index: number) {
  const { year, month } = timelineMonth(index);
  return utcMonth(year, month);
}

export function timelineMonthValue(index: number) {
  return timelineMonthDate(index).toISOString().slice(0, -17);
}

export function timelineTicks(min: number, max: number) {
  const span = (max - min) / 12;
  const target = span / 5;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, target)));
  const step = Math.max(1, ([1, 2, 5, 10].find(value => value * magnitude >= target) ?? 10) * magnitude);
  const ticks = [min];
  for (let year = Math.ceil((min + 1) / (step * 12)) * step; year * 12 < max; year += step) {
    const index = year * 12;
    if (index - min >= step * 3 && max - index >= step * 3) ticks.push(index);
  }
  if (max > min) ticks.push(max);
  return ticks;
}
