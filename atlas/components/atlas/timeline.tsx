"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Play, Pause, History, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import type { Settings } from "@/lib/atlas";
import { selectedTimelineRange, timelineMonth, timelineMonthValue, timelineTicks, utcMonth } from "@/lib/timeline";
import { calendarLabels } from "@/lib/calendar";
import { monthIndex } from "@/lib/directory-filters";
import { useI18n } from "@/components/i18n/provider";
import MonthPicker from "./month-picker";
import { useMapFullscreen } from "./map-experience";
export default function Timeline({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const { t, date, calendar } = useI18n();
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const { expanded, timelineOpen } = useMapFullscreen();
  const value = settings.year * 12 + settings.month;
  const range = selectedTimelineRange(settings.timelineYears);
  const { min, max, currentYear, currentMonth } = range;
  const current = useRef({ value, onChange });
  useLayoutEffect(() => { current.current = { value, onChange }; }, [value, onChange]);
  const setDate = (value: number) => { const date = Math.max(min, Math.min(max, value)); onChange(timelineMonth(date)); };
  useEffect(() => {
    if (!playing) return;
    let remainder = 0;
    // Two beats per second: fractional months carry into the next beat.
    // 0.5x: 1 month/s; 1x: 2; 1.5x: 3; 2x: 4.
    const timer = setInterval(() => {
      remainder += playbackSpeed;
      const months = Math.floor(remainder);
      remainder -= months;
      const { value, onChange } = current.current;
      const next = Math.min(value + months, max);
      if (next !== value) onChange(timelineMonth(next));
      if (next >= max) setPlaying(false);
    }, 500);
    return () => clearInterval(timer);
  }, [playing, max, playbackSpeed]);
  const tickDate = (index: number) => {
    const { year, month } = timelineMonth(index);
    return utcMonth(year, month);
  };
  const yearLabel = (index: number) => date(tickDate(index), { year: "numeric" });
  const startLabel = yearLabel(min), endLabel = yearLabel(max);
  const ticks = timelineTicks(min, max).filter(index => index === min || index === max || ![startLabel, endLabel].includes(yearLabel(index)));
  return <section id="map-timeline" data-tour="timeline" hidden={expanded && !timelineOpen} className="timeline" title={t(calendarLabels[calendar])} aria-label={t("Historical timeline")}>
    <div className="timeline-heading">
      <span className="timeline-title"><History size={17} />{" " + t("Through time")}</span>
      <span className="timeline-subtitle">{t("A different year. A different world.")}</span>
      <button type="button" className="text-link" disabled={currentYear * 12 + currentMonth < min || currentYear * 12 + currentMonth > max}
        onClick={() => { setPlaying(false); setDate(currentYear * 12 + currentMonth); }}>{t("Back to today") + " "}<ChevronRight size={13} /></button>
    </div>
    <div className="timeline-body">
      <div className="timeline-playback">
        <button type="button" className="timeline-play" aria-label={playing ? t("Pause timeline") : t("Play timeline")} onClick={() => { if (!playing && value >= max) setDate(min); setPlaying(!playing); }}>
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        {playing && <label className="timeline-speed" title={t("Playback speed")}><Clock3 size={15} aria-hidden="true" /><span aria-hidden="true" dir="ltr">{playbackSpeed}x</span>
          <select aria-label={t("Playback speed")} dir="ltr" value={playbackSpeed} onChange={event => setPlaybackSpeed(Number(event.target.value))}>{[0.5, 1, 1.5, 2].map(speed => <option key={speed} value={speed}>{speed}x</option>)}</select>
        </label>}
      </div>
      <div className="timeline-slider">
        <input aria-label={t("Timeline month")} aria-valuetext={date(tickDate(value), { month: "long", year: "numeric", ...(calendar === "gregory" ? {} : { day: "numeric" }) })}
          type="range" min={min} max={max} value={value} onChange={event => { setPlaying(false); setDate(Number(event.target.value)); }}
          style={{ "--range-progress": `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} />
        <div className="timeline-ticks">{ticks.map(index =>
          <button type="button" key={index} data-timeline-month={timelineMonthValue(index)} onClick={() => { setPlaying(false); setDate(index); }}>
            {startLabel === endLabel ? date(tickDate(index)) : yearLabel(index)}
          </button>
        )}</div>
      </div>
      <div className="timeline-date">
        <button type="button" className="icon-plain" aria-label={t("Previous month")} disabled={value <= min} onClick={() => { setPlaying(false); setDate(value - 1); }}><ChevronLeft size={15} /></button>
        <MonthPicker label={t("Historical timeline")} ariaLabel={t("Timeline month")} value={timelineMonthValue(value)} bounds={range}
          compact allowClear={false} onOpen={() => setPlaying(false)} onChange={month => { if (month) setDate(monthIndex(month)); }} />
        <button type="button" className="icon-plain" aria-label={t("Next month")} disabled={value >= max} onClick={() => { setPlaying(false); setDate(value + 1); }}><ChevronRight size={15} /></button>
      </div>
    </div>
  </section>;
}
