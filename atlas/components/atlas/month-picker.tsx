"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { getTimelineRange } from "@/lib/timeline";
import { monthIndex } from "@/lib/directory-filters";

export default function MonthPicker({ label, ariaLabel, value, onChange }: { label: string; ariaLabel: string; value: string; onChange: (value: string) => void }) {
  const { t, date, n, locale } = useI18n();
  const id = useId(), titleId = useId();
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const focusMonth = useRef(false);
  const [open, setOpen] = useState(false), [year, setYear] = useState("");
  const [cursor, setCursor] = useState(0);
  const [placement, setPlacement] = useState({ above: false, height: 420 });
  const { min, max, currentYear, currentMonth } = getTimelineRange();
  const firstYear = Math.floor(min / 12), lastYear = Math.floor(max / 12);
  const yearNumber = Number(year), validYear = /^\d{4}$/.test(year) && yearNumber >= firstYear && yearNumber <= lastYear;
  const selected = /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? monthIndex(value) : null;
  const clamp = (index: number) => Math.max(min, Math.min(max, index));
  function close() { setOpen(false); trigger.current?.focus(); }
  function choose(index: number | null) {
    onChange(index === null ? "" : `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`);
    close();
  }
  function show() {
    const index = clamp(selected ?? currentYear * 12 + currentMonth);
    setYear(String(Math.floor(index / 12))); setCursor(index); focusMonth.current = true; setOpen(true);
  }
  function changeYear(next: string) {
    setYear(next);
    if (/^\d{4}$/.test(next)) setCursor(clamp(Number(next) * 12 + cursor % 12));
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
      setPlacement({ above: upwards, height: Math.max(120, Math.min(420, upwards ? above : below)) });
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
    <label htmlFor={id}>{label}</label>
    <button ref={trigger} id={id} type="button" className="soft-input month-picker-trigger" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined} data-month-value={value} onClick={() => open ? close() : show()}>
      <span>{selected === null ? t("Choose month and year") : date(new Date(Date.UTC(Math.floor(selected / 12), selected % 12, 1)), { month: "long", year: "numeric" })}</span><CalendarDays size={18} />
    </button>
    {open && <div ref={panel} id={`${id}-panel`} className={`month-picker-panel${placement.above ? " is-above" : ""}`} style={{ maxHeight: placement.height }} role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <div className="month-picker-heading"><strong id={titleId}>{label}<small>{t("Gregorian calendar")}</small></strong><button className="icon-button" type="button" aria-label={t("Close")} onClick={close}><X size={17} /></button></div>
      <div className="month-picker-year" dir="ltr">
        <button type="button" className="icon-button" aria-label={t("Previous year")} disabled={!validYear || yearNumber <= firstYear} onClick={() => changeYear(String(yearNumber - 1))}><ChevronLeft size={18} /></button>
        <label><span className="sr-only">{t("Year")}</span><input type="number" className="soft-input" aria-label={t("Year")} value={year} min={firstYear} max={lastYear} step={1} aria-invalid={!validYear} onChange={event => changeYear(event.target.value)} /></label>
        <button type="button" className="icon-button" aria-label={t("Next year")} disabled={!validYear || yearNumber >= lastYear} onClick={() => changeYear(String(yearNumber + 1))}><ChevronRight size={18} /></button>
      </div>
      <p className="month-picker-range">{t("Year range: {min}–{max}", { min: n(firstYear, { useGrouping: false }), max: n(lastYear, { useGrouping: false }) })}</p>
      <div className="month-picker-grid" role="group" aria-label={t("Choose month")} onKeyDown={event => {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-month-index]");
        if (!target) return;
        const current = Number(target.dataset.monthIndex), rtl = locale === "fa";
        const moves: Record<string, number> = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -4, ArrowDown: 4, PageUp: -12, PageDown: 12, Home: -(current % 12), End: 11 - current % 12 };
        if (moves[event.key] === undefined) return;
        event.preventDefault(); const index = clamp(current + moves[event.key]); focusMonth.current = true; setYear(String(Math.floor(index / 12))); setCursor(index);
        if (index === cursor) { target.focus(); focusMonth.current = false; }
      }}>
        {Array.from({ length: 12 }, (_, month) => {
          const index = yearNumber * 12 + month;
          return <button key={month} type="button" data-month-index={index} data-month-option={validYear ? `${year}-${String(month + 1).padStart(2, "0")}` : ""} tabIndex={month === cursor % 12 ? 0 : -1} disabled={!validYear || index < min || index > max} aria-pressed={index === selected} aria-label={validYear ? date(new Date(Date.UTC(yearNumber, month, 1)), { month: "long", year: "numeric" }) : undefined} onFocus={() => setCursor(index)} onClick={() => choose(index)}>{date(new Date(Date.UTC(2000, month, 1)), { month: "short" })}</button>;
        })}
      </div>
      <div className="month-picker-footer"><button type="button" onClick={() => choose(null)}>{t("Clear")}</button><button type="button" onClick={() => choose(currentYear * 12 + currentMonth)}>{t("This month")}</button></div>
    </div>}
  </div>;
}
