"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { formatCalendarDate } from "@/lib/calendar";
import { getTimelineRange, timelineMonth, timelineMonthValue, utcMonth, type TimelineBounds } from "@/lib/timeline";
import { monthIndex } from "@/lib/directory-filters";

export default function MonthPicker({ label, ariaLabel, value, onChange, compact = false, allowClear = true, onOpen, bounds }: { label: string; ariaLabel: string; value: string; onChange: (value: string) => void; compact?: boolean; allowClear?: boolean; onOpen?: () => void; bounds?: TimelineBounds }) {
  const { t, date, locale, calendar } = useI18n();
  const id = useId(), titleId = useId();
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const focusMonth = useRef(false);
  const horizontalShift = useRef(0);
  const [open, setOpen] = useState(false), [year, setYear] = useState("");
  const [before, setBefore] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [placement, setPlacement] = useState({ above: false, height: 420, shift: 0 });
  const defaults = getTimelineRange();
  const { min, max } = bounds ?? defaults;
  const today = defaults.currentYear * 12 + defaults.currentMonth;
  const firstYear = Math.floor(min / 12), lastYear = Math.floor(max / 12);
  const yearNumber = before ? 1 - Number(year) : Number(year);
  const validYear = /^\d{1,4}$/.test(year) && Number(year) > 0 && yearNumber >= firstYear && yearNumber <= lastYear;
  const selection = monthIndex(value);
  const selected = Number.isFinite(selection) ? selection : null;
  const dateAt = (index: number) => { const { year, month } = timelineMonth(index); return utcMonth(year, month); };
  const showYear = (year: number) => {
    setBefore(year <= 0);
    setYear(String(year <= 0 ? 1 - year : year));
  };
  const clamp = (index: number) => Math.max(min, Math.min(max, index));
  function close() { setOpen(false); trigger.current?.focus(); }
  function choose(index: number | null) {
    onChange(index === null ? "" : timelineMonthValue(clamp(index)));
    close();
  }
  function show() {
    onOpen?.();
    const index = clamp(selected ?? today);
    showYear(timelineMonth(index).year); setCursor(index); focusMonth.current = true; setOpen(true);
  }
  function changeYear(next: string, beforeEra = before) {
    setYear(next);
    setBefore(beforeEra);
    if (/^\d{1,4}$/.test(next) && Number(next) > 0) {
      setCursor(clamp((beforeEra ? 1 - Number(next) : Number(next)) * 12 + timelineMonth(cursor).month));
    }
  }
  function stepYear(next: number) {
    changeYear(String(next <= 0 ? 1 - next : next), next <= 0);
  }
  useLayoutEffect(() => {
    if (!open) return;
    const target = root.current?.querySelector<HTMLButtonElement>(`[data-month-index="${cursor}"]`);
    if (focusMonth.current) { target?.focus({ preventScroll: true }); focusMonth.current = false; }
    if (target && document.activeElement === target && panel.current) {
      const item = target.getBoundingClientRect(), menu = panel.current.getBoundingClientRect();
      if (item.top < menu.top) panel.current.scrollTop -= menu.top - item.top + 8;
      else if (item.bottom > menu.bottom) panel.current.scrollTop += item.bottom - menu.bottom + 8;
    }
  }, [open, cursor, year, placement.above, placement.height]);
  useLayoutEffect(() => {
    if (!open) return;
    const fit = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0, bottom = top + (viewport?.height ?? innerHeight);
      const below = bottom - rect.bottom - 12, above = (root.current?.getBoundingClientRect().top ?? rect.top) - top - 12;
      const upwards = below < (panel.current?.scrollHeight ?? 360) && above > below;
      const menu = panel.current?.getBoundingClientRect();
      const left = (menu?.left ?? rect.left) - horizontalShift.current;
      const right = (menu?.right ?? rect.right) - horizontalShift.current;
      const edge = viewport?.offsetLeft ?? 0;
      const shift = Math.max(edge + 8 - left, Math.min(0, edge + (viewport?.width ?? innerWidth) - 8 - right));
      horizontalShift.current = shift;
      setPlacement({ above: upwards, height: Math.max(120, Math.min(420, upwards ? above : below)), shift });
    };
    fit(); window.addEventListener("resize", fit); window.addEventListener("scroll", fit, true);
    window.visualViewport?.addEventListener("resize", fit);
    return () => { window.removeEventListener("resize", fit); window.removeEventListener("scroll", fit, true); window.visualViewport?.removeEventListener("resize", fit); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div ref={root} className="directory-month-field" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }} onKeyDown={event => { if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <label htmlFor={id} className={compact ? "sr-only" : undefined}>{label}</label>
    <button ref={trigger} id={id} type="button" className="soft-input month-picker-trigger" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined} data-month-value={value} onClick={() => open ? close() : show()}>
      {compact ? <strong>{selected === null ? t("Choose month and year") : date(dateAt(selected))}</strong> : <span>{selected === null ? t("Choose month and year") : date(dateAt(selected), { month: "long", year: "numeric" })}</span>}<CalendarDays size={18} />
    </button>
    {open && <div ref={panel} id={`${id}-panel`} className={`month-picker-panel${placement.above ? " is-above" : ""}`} style={{ maxHeight: placement.height, transform: `translateX(${placement.shift}px)` }} role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <div className="month-picker-heading"><strong id={titleId}>{label}<small>{t("Gregorian calendar")}</small></strong><button className="icon-button" type="button" aria-label={t("Close")} onClick={close}><X size={17} /></button></div>
      <div className="month-picker-year" dir="ltr">
        <button type="button" className="icon-button" aria-label={t("Previous year")} disabled={!validYear || yearNumber <= firstYear} onClick={() => stepYear(yearNumber - 1)}><ChevronLeft size={18} /></button>
        <label><span className="sr-only">{t("Year")}</span><input type="number" className="soft-input" aria-label={t("Year")} value={year} min={firstYear > 0 ? firstYear : 1} max={firstYear > 0 ? lastYear : 9999} step={1} aria-invalid={!validYear} onChange={event => changeYear(event.target.value)} /></label>
        <button type="button" className="icon-button" aria-label={t("Next year")} disabled={!validYear || yearNumber >= lastYear} onClick={() => stepYear(yearNumber + 1)}><ChevronRight size={18} /></button>
      </div>
      {firstYear <= 0 && <select className="soft-input month-picker-era" aria-label={t("Era")} value={before ? "before" : "after"} onChange={event => changeYear(year, event.target.value === "before")}>
        <option value="after" disabled={lastYear < 1}>{t("Common Era")}</option><option value="before">{t("Before Christ")}</option>
      </select>}
      <p className="month-picker-range">{t("Year range: {min}–{max}", {
        min: formatCalendarDate(utcMonth(firstYear), locale, "gregory", { year: "numeric" }),
        max: formatCalendarDate(utcMonth(lastYear), locale, "gregory", { year: "numeric" }),
      })}</p>
      <div className="month-picker-grid" role="group" aria-label={t("Choose month")} onKeyDown={event => {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-month-index]");
        if (!target) return;
        const current = Number(target.dataset.monthIndex), rtl = locale === "fa";
        const moves: Record<string, number> = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -4, ArrowDown: 4, PageUp: -12, PageDown: 12, Home: -timelineMonth(current).month, End: 11 - timelineMonth(current).month };
        if (moves[event.key] === undefined) return;
        event.preventDefault(); const index = clamp(current + moves[event.key]); focusMonth.current = true; showYear(timelineMonth(index).year); setCursor(index);
        if (index === cursor) { target.focus(); focusMonth.current = false; }
      }}>
        {Array.from({ length: 12 }, (_, month) => {
          const index = yearNumber * 12 + month;
          return <button key={month} type="button" data-month-index={index} data-month-option={validYear ? timelineMonthValue(index) : ""} tabIndex={month === timelineMonth(cursor).month ? 0 : -1} disabled={!validYear || index < min || index > max} aria-pressed={index === selected} aria-label={validYear ? date(dateAt(index), { month: "long", year: "numeric", ...(calendar === "gregory" ? {} : { day: "numeric" }) }) : undefined} onFocus={() => setCursor(index)} onClick={() => choose(index)}>{validYear ? date(dateAt(index), calendar === "gregory" ? { month: "short" } : { month: "short", day: "numeric" }) : ""}</button>;
        })}
      </div>
      <div className="month-picker-footer">{allowClear && <button type="button" onClick={() => choose(null)}>{t("Clear")}</button>}<button type="button" onClick={() => choose(today)}>{t("This month")}</button></div>
    </div>}
  </div>;
}
