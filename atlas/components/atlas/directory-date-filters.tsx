"use client";

import { useId, useRef } from "react";
import { CalendarDays } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { validDirectoryRange, type DirectoryRange } from "@/lib/directory-filters";
import { getTimelineRange, TIMELINE_START_YEAR } from "@/lib/timeline";

function MonthField({ label, ariaLabel, value, onChange }: { label: string; ariaLabel: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();
  const { endYear, endMonth } = getTimelineRange();
  return <div className="directory-month-field"><label htmlFor={id}>{label}</label><div className="directory-month-input">
    <input ref={ref} id={id} className="soft-input" type="month" aria-label={ariaLabel} min={`${TIMELINE_START_YEAR}-01`} max={`${endYear}-${String(endMonth + 1).padStart(2, "0")}`} value={value} onChange={event => onChange(event.target.value)} />
    <button type="button" aria-label={label} onClick={() => { try { ref.current?.showPicker(); } catch { ref.current?.focus(); } }}><CalendarDays size={18} /></button>
  </div></div>;
}
export default function DirectoryDateFilters({ range, onChange }: { range: DirectoryRange; onChange: (range: DirectoryRange) => void }) {
  const { t } = useI18n();
  return <fieldset className="directory-date-range"><legend>{t("Date range")}<span className="calendar-type">{t("Gregorian calendar")}</span></legend><div className="directory-date-fields">
    <MonthField label={t("Start date")} ariaLabel={t("Directory date")} value={range.from} onChange={from => onChange({ ...range, from })} />
    <MonthField label={t("End date")} ariaLabel={t("Directory end date")} value={range.to} onChange={to => onChange({ ...range, to })} />
  </div>{!validDirectoryRange(range) && <p className="form-error" role="alert">{t("Choose a valid date range. The end must not precede the start.")}</p>}</fieldset>;
}
