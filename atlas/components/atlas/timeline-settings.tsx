"use client";

import { useState } from "react";
import { CalendarDays, History } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import type { Settings } from "@/lib/atlas";
import { calendarLabels, formatCalendarDate, type AtlasCalendar } from "@/lib/calendar";
import { getTimelineRange, TIMELINE_START_YEAR, utcMonth } from "@/lib/timeline";

function yearField(year: number) {
  return { number: String(year <= 0 ? 1 - year : year), before: year <= 0 };
}

export function TimelineRangeSettings({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<{ start: ReturnType<typeof yearField>; end: ReturnType<typeof yearField> } | null>(null);
  const values = draft ?? {
    start: yearField(settings.timelineYears?.startYear ?? TIMELINE_START_YEAR),
    end: yearField(settings.timelineYears?.endYear ?? getTimelineRange().endYear),
  };
  const yearValue = ({ number, before }: ReturnType<typeof yearField>) => {
    if (!/^\d{1,4}$/.test(number) || Number(number) < 1) return NaN;
    return before ? 1 - Number(number) : Number(number);
  };
  const startYear = yearValue(values.start), endYear = yearValue(values.end);
  const valid = Number.isFinite(startYear) && Number.isFinite(endYear) && startYear <= endYear;
  return <section className="settings-card">
    <div className="settings-card-heading"><span className="large-icon"><History size={23} /></span><div>
      <h2>{t("Timeline range")}</h2><p>{t("Enter the start and end years in the Gregorian calendar.")}</p>
    </div></div>
    <form className="timeline-settings-form" onSubmit={event => {
      event.preventDefault();
      if (valid) { onChange({ timelineYears: { startYear, endYear } }); setDraft(null); }
    }}>
      {(["start", "end"] as const).map(key => {
        const label = key === "start" ? t("Timeline start year") : t("Timeline end year");
        return <div key={key} className="timeline-year-fields">
          <label>{label}<input className="soft-input" type="number" min={1} max={9999} required dir="ltr"
            value={values[key].number} onChange={event => setDraft({ ...values, [key]: { ...values[key], number: event.target.value } })} /></label>
          <label>{t("Era")}<select className="soft-input" aria-label={t(key === "start" ? "Start year era" : "End year era")} value={values[key].before ? "before" : "after"}
            onChange={event => setDraft({ ...values, [key]: { ...values[key], before: event.target.value === "before" } })}>
            <option value="after">{t("Common Era")}</option><option value="before">{t("Before Christ")}</option>
          </select></label>
        </div>;
      })}
      {draft && !valid && <p className="form-error" role="alert">{t("Choose valid years. The end must not precede the start.")}</p>}
      <div className="profile-photo-actions">
        <button type="submit" className="primary-button" disabled={!draft || !valid}>{t("Apply timeline range")}</button>
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
      <label>{t("Gregorian date to convert")}<input type="date" className="soft-input" value={preview}
        min="0001-01-01" max="9999-12-31" onChange={event => setPreview(event.target.value)} /></label>
      <dl className="calendar-preview">
        {(Object.entries(calendarLabels) as [AtlasCalendar, typeof calendarLabels[AtlasCalendar]][]).map(([calendar, label]) => <div key={calendar}>
          <dt>{t(label)}</dt><dd>{formatCalendarDate(converted, locale, calendar, { year: "numeric", month: "long", day: "numeric" })}</dd>
        </div>)}
      </dl>
      <p className="field-hint">{t("Lunar Hijri dates use the tabular civil calendar.")}</p>
    </div>
  </section>;
}
