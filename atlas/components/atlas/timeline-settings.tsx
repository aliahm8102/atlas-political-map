"use client";

import { useState } from "react";
import { CalendarDays, History } from "lucide-react";
import { CalendarProvider, useI18n } from "@/components/i18n/provider";
import type { Settings } from "@/lib/atlas";
import { calendarLabels, calendarYear, formatCalendarDate, timelineYearsFromCalendar, type AtlasCalendar } from "@/lib/calendar";
import { MAX_TIMELINE_YEAR, MIN_TIMELINE_YEAR, selectedTimelineRange, timelineMonthDate, utcMonth } from "@/lib/timeline";
import MonthPicker from "./month-picker";

const dateBounds = { min: MIN_TIMELINE_YEAR * 12, max: MAX_TIMELINE_YEAR * 12 + 11 };

function yearField(year: number) {
  return { number: String(year <= 0 ? 1 - year : year), before: year <= 0 };
}

export function TimelineRangeSettings({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const { t, calendar } = useI18n();
  const [draft, setDraft] = useState<{ start: ReturnType<typeof yearField>; end: ReturnType<typeof yearField> } | null>(null);
  const range = selectedTimelineRange(settings.timelineYears);
  const values = draft ?? {
    start: yearField(calendarYear(timelineMonthDate(range.min), calendar)),
    end: yearField(calendarYear(timelineMonthDate(range.max), calendar)),
  };
  const yearValue = ({ number, before }: ReturnType<typeof yearField>) => {
    if (!/^\d{1,5}$/.test(number) || Number(number) < 1) return NaN;
    return before ? 1 - Number(number) : Number(number);
  };
  const years = timelineYearsFromCalendar(yearValue(values.start), yearValue(values.end), calendar);
  const converted = years && selectedTimelineRange(years);
  const changed = converted && (converted.min !== range.min || converted.max !== range.max);
  const beforeLabel = calendar === "gregory" ? t("Before Christ") : t("Before Hijra");
  const afterLabel = calendar === "gregory" ? t("Common Era") : t("After Hijra");
  return <section className="settings-card">
    <div className="settings-card-heading"><span className="large-icon"><History size={23} /></span><div>
      <h2>{t("Timeline range")}</h2><p>{t(calendarLabels[calendar])}</p>
    </div></div>
    <form className="timeline-settings-form" onSubmit={event => {
      event.preventDefault();
      if (years) { onChange({ timelineYears: years }); setDraft(null); }
    }}>
      {(["start", "end"] as const).map(key => {
        const label = key === "start" ? t("Timeline start year") : t("Timeline end year");
        return <div key={key} className="timeline-year-fields">
          <label>{label}<input className="soft-input" type="number" min={1} max={calendar === "gregory" ? 9999 : 12000} required dir="ltr"
            value={values[key].number} onChange={event => setDraft({ ...values, [key]: { ...values[key], number: event.target.value } })} /></label>
          <label>{t("Era")}<select className="soft-input" aria-label={t(key === "start" ? "Start year era" : "End year era")} value={values[key].before ? "before" : "after"}
            onChange={event => setDraft({ ...values, [key]: { ...values[key], before: event.target.value === "before" } })}>
            <option value="after">{afterLabel}</option><option value="before">{beforeLabel}</option>
          </select></label>
        </div>;
      })}
      {draft && !years && <p className="form-error" role="alert">{t("Choose valid years. The end must not precede the start.")}</p>}
      <div className="profile-photo-actions">
        <button type="submit" className="primary-button" disabled={!changed}>{t("Apply timeline range")}</button>
        <button type="button" className="secondary-button" disabled={!settings.timelineYears && !draft} onClick={() => { onChange({ timelineYears: null }); setDraft(null); }}>{t("Restore default range")}</button>
      </div>
    </form>
  </section>;
}

export function CalendarSettings({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const { t, locale } = useI18n();
  const [preview, setPreview] = useState("");
  const selected = utcMonth(settings.year, settings.month);
  const converted = preview ? new Date(`${preview}T00:00:00Z`) : selected;
  return <section className="settings-card">
    <div className="settings-card-heading"><span className="large-icon"><CalendarDays size={23} /></span><h2>{t("Calendar")}</h2></div>
    <div className="timeline-settings-form">
      <label>{t("Display calendar")}<select className="soft-input" value={settings.calendar} onChange={event => onChange({ calendar: event.target.value as AtlasCalendar })}>
        {Object.entries(calendarLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
      </select></label>
      <CalendarProvider calendar="gregory">
        <MonthPicker label={t("Gregorian date to convert")} ariaLabel={t("Gregorian date to convert")}
          value={preview || selected.toISOString().split("T")[0]} onChange={setPreview} bounds={dateBounds} precision="day" allowClear={false} />
      </CalendarProvider>
      <dl className="calendar-preview">
        {(Object.entries(calendarLabels) as [AtlasCalendar, typeof calendarLabels[AtlasCalendar]][]).map(([calendar, label]) => <div key={calendar}>
          <dt>{t(label)}</dt><dd>{formatCalendarDate(converted, locale, calendar, { year: "numeric", month: "long", day: "numeric" })}</dd>
        </div>)}
      </dl>
      <p className="field-hint">{t("Lunar Hijri dates use the tabular civil calendar.")}</p>
    </div>
  </section>;
}
