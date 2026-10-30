"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Play, Pause, History, ChevronLeft, ChevronRight, CalendarDays, Clock3 } from "lucide-react";
import type { Settings } from "@/lib/atlas";
import { getTimelineRange, TIMELINE_START_YEAR } from "@/lib/timeline";
import { useI18n } from "@/components/i18n/provider";
import { useMapFullscreen } from "./map-experience";
export default function Timeline({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const { t, n, date } = useI18n();
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const { expanded, timelineOpen } = useMapFullscreen();
  const value = settings.year * 12 + settings.month;
  const { min, max, endYear } = getTimelineRange();
  const current = useRef({ value, onChange });
  useLayoutEffect(() => { current.current = { value, onChange }; }, [value, onChange]);
  const setDate = (value: number) => { const date = Math.max(min, Math.min(max, value)); onChange({ year: Math.floor(date / 12), month: date % 12 }); };
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
      if (next !== value) onChange({ year: Math.floor(next / 12), month: next % 12 });
      if (next >= max) setPlaying(false);
    }, 500);
    return () => clearInterval(timer);
  }, [playing, max, playbackSpeed]);
  const label = date(new Date(Date.UTC(settings.year, settings.month, 1)));
  return <section id="map-timeline" data-tour="timeline" hidden={expanded && !timelineOpen} className="timeline" title={t("Dates use the Gregorian calendar.")} aria-label={t("Historical timeline")}><div className="timeline-heading"><span className="timeline-title"><History size={17} />{" " + t("Through time")}</span><span className="timeline-subtitle">{t("A different year. A different world.")}</span><button className="text-link" onClick={() => { setPlaying(false); const { currentYear: year, currentMonth: month } = getTimelineRange(); onChange({ year, month }); }}>{t("Back to today") + " "}<ChevronRight size={13} /></button></div><div className="timeline-body"><div className="timeline-playback"><button className="timeline-play" aria-label={playing ? t("Pause timeline") : t("Play timeline")} onClick={() => { if (value >= max) setDate(min); setPlaying(!playing); }}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>{playing && <label className="timeline-speed" title={t("Playback speed")}><Clock3 size={15} aria-hidden="true" /><span aria-hidden="true" dir="ltr">{playbackSpeed}x</span><select aria-label={t("Playback speed")} dir="ltr" value={playbackSpeed} onChange={event => setPlaybackSpeed(Number(event.target.value))}>{[0.5, 1, 1.5, 2].map(speed => <option key={speed} value={speed}>{speed}x</option>)}</select></label>}</div><div className="timeline-slider"><input aria-label={t("Timeline month")} type="range" min={min} max={max} value={value} onChange={e => { setPlaying(false); setDate(Number(e.target.value)); }} style={{ "--range-progress": `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} /><div className="timeline-ticks">{[TIMELINE_START_YEAR, 1925, 1950, 1975, 2000, endYear].map(year => <button key={year} onClick={() => { setPlaying(false); onChange({ year, month: 0 }); }}>{n(year, { useGrouping: false })}</button>)}</div></div><div className="timeline-date"><button className="icon-plain" aria-label={t("Previous month")} disabled={value <= min} onClick={() => { setPlaying(false); setDate(value - 1); }}><ChevronLeft size={15} /></button><CalendarDays size={15} /><strong>{label}</strong><button className="icon-plain" aria-label={t("Next month")} disabled={value >= max} onClick={() => { setPlaying(false); setDate(value + 1); }}><ChevronRight size={15} /></button></div></div></section>;
}
