"use client";
import { useEffect, useState } from "react";
import { Play, Pause, History, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { Settings } from "@/lib/atlas";
import { useI18n } from "@/components/i18n/provider";
export default function Timeline({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const { t, n, date } = useI18n();
  const [playing, setPlaying] = useState(false);
  const value = settings.year * 12 + settings.month;
  const min = 1900 * 12; const max = 2026 * 12 + 11;
  const setDate = (value: number) => { const date = Math.max(min, Math.min(max, value)); onChange({ year: Math.floor(date / 12), month: date % 12 }); };
  useEffect(() => {
    if (!playing || value >= max) return;
    const timer = setTimeout(() => { const next = Math.min(value + 6, max); onChange({ year: Math.floor(next / 12), month: next % 12 }); if (next >= max) setPlaying(false); }, 650);
    return () => clearTimeout(timer);
  }, [playing, value, max, onChange]);
  const label = date(new Date(Date.UTC(settings.year, settings.month, 1)));
  return <section className="timeline" title={t("Dates use the Gregorian calendar.")} aria-label={t("Historical timeline")}><div className="timeline-heading"><span className="timeline-title"><History size={17} />{" " + t("Through time")}</span><span className="timeline-subtitle">{t("A different year. A different world.")}</span><button className="text-link" onClick={() => { setPlaying(false); onChange({ year: 2026, month: 9 }); }}>{t("Back to Oct 2026") + " "}<ChevronRight size={13} /></button></div><div className="timeline-body"><button className="timeline-play" aria-label={playing ? t("Pause timeline") : t("Play timeline")} onClick={() => { if (value >= max) setDate(min); setPlaying(!playing); }}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><div className="timeline-slider"><input aria-label={t("Timeline month")} type="range" min={min} max={max} value={value} onChange={e => { setPlaying(false); setDate(Number(e.target.value)); }} style={{ "--range-progress": `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} /><div className="timeline-ticks">{[1900, 1925, 1950, 1975, 2000, 2026].map(year => <button key={year} onClick={() => { setPlaying(false); onChange({ year, month: 0 }); }}>{n(year, { useGrouping: false })}</button>)}</div></div><div className="timeline-date"><button className="icon-plain" aria-label={t("Previous month")} disabled={value <= min} onClick={() => { setPlaying(false); setDate(value - 1); }}><ChevronLeft size={15} /></button><CalendarDays size={15} /><strong>{label}</strong><button className="icon-plain" aria-label={t("Next month")} disabled={value >= max} onClick={() => { setPlaying(false); setDate(value + 1); }}><ChevronRight size={15} /></button></div></div></section>;
}
