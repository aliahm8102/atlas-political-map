"use client";

import { useI18n } from "@/components/i18n/provider";
import { validDirectoryRange, type DirectoryRange } from "@/lib/directory-filters";
import type { TimelineBounds } from "@/lib/timeline";
import { calendarLabels } from "@/lib/calendar";
import MonthPicker from "./month-picker";
export default function DirectoryDateFilters({ range, bounds, onChange }: { range: DirectoryRange; bounds?: TimelineBounds; onChange: (range: DirectoryRange) => void }) {
  const { t, calendar } = useI18n();
  return <fieldset className="directory-date-range"><legend>{t("Date range")}<span className="calendar-type">{t(calendarLabels[calendar])}</span></legend><div className="directory-date-fields">
    <MonthPicker bounds={bounds} label={t("Start date")} ariaLabel={t("Directory date")} value={range.from} onChange={from => onChange({ ...range, from })} />
    <MonthPicker bounds={bounds} label={t("End date")} ariaLabel={t("Directory end date")} value={range.to} onChange={to => onChange({ ...range, to })} />
  </div>{!validDirectoryRange(range, bounds) && <p className="form-error" role="alert">{t("Choose a valid date range. The end must not precede the start.")}</p>}</fieldset>;
}
