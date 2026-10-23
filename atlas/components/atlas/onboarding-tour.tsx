"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Compass, Globe2 } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";

const siteKey = "atlas-tour-v1";
const mapKey = "atlas-map-tour-v1";
const siteSteps = [
  { target: '[data-tour="search"]', title: "Find people and places", description: "Search names, countries or roles in Persian or English. Suggestions and filters help you narrow the results." },
  { target: '[data-tour="mobile-navigation"], [data-tour="navigation"]', title: "Your way around Atlas", description: "Use navigation to explore the map, browse people, open bookmarks or create your own characters." },
  { target: '[data-tour="map"]', title: "Explore the world", description: "Drag to move around and zoom in for a closer look. Select a country or portrait to discover its details." },
  { target: '[data-tour="map-type"]', title: "A choice of perspectives", description: "Open this menu to preview the map types. Terrain and Natural views are coming soon." },
  { target: '[data-tour="layers"]', title: "Focus your map", description: "Choose the roles and layers you want to see. You can reset these filters whenever you like." },
  { target: '[data-tour="timeline"]', title: "Travel through time", description: "Choose a date or play the timeline to explore recorded terms across the years. The collection is an imported historical snapshot." },
  { target: '[data-tour="profile"]', title: "Make yourself at home", description: "Open My workspace to change your profile, theme, accent and text size. Your preferences stay saved." },
  { target: '[data-tour="fullscreen"]', title: "Your next journey", description: "Open the map and let us begin a new journey" },
] as const;
const mapSteps = [
  { target: '[data-map-tour="drawing-toggle"]', title: "Your map toolkit", description: "The pencil button opens drawing and measurement tools. Use the hand tool whenever you want to pan the map again." },
  { target: '#map-drawing-tools', title: "Draw with the pencil", description: "Choose Pencil and pick a preset or custom color. Drag on the map to draw a sketch. Your strokes stay aligned when you pan or zoom." },
  { target: '[data-map-tour="eraser"]', title: "Erase your sketches", description: "Choose Eraser and drag across a pencil stroke to remove it. Countries, portraits and your saved data are not erased." },
  { target: '#map-drawing-tools', title: "Measure a route", description: "Choose Ruler and tap two or more points. See each segment and the total distance in meters or kilometers. Undo removes the last point; Clear removes only the measurement." },
  { target: '[data-map-tour="settings"]', title: "Open map settings", description: "This button shows or hides the side panel. Country details appear here when you select a country or a portrait." },
  { target: '[data-tour="layers"]', title: "Choose roles and layers", description: "Turn roles on or off to control which people appear. Toggle the NATO layer or reset filters. This tour leaves your choices unchanged." },
  { target: '[data-map-tour="timeline"]', title: "Keep time within reach", description: "The clock button shows or hides the timeline, giving the map more room when you need it." },
  { target: '[data-tour="timeline"]', title: "Explore the timeline", description: "Drag the date slider, use previous and next month, or press Play. While playing, choose 0.5x, 1x, 1.5x or 2x speed. The date controls which recorded terms appear on the map." },
] as const;

function hasSeenTour(storageKey: string) {
  try { if (localStorage.getItem(storageKey) === "done") return true; } catch { /* Cookie fallback. */ }
  try { return document.cookie.split(";").some(value => value.trim() === `${storageKey}=done`); } catch { return false; }
}
function rememberTour(storageKey: string) {
  try { localStorage.setItem(storageKey, "done"); } catch { /* Cookie fallback. */ }
  try { document.cookie = `${storageKey}=done; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; } catch { /* Storage may be unavailable. */ }
}
function resetTour(storageKey: string) {
  try { localStorage.removeItem(storageKey); } catch { /* Cookie fallback. */ }
  try { document.cookie = `${storageKey}=; Path=/; Max-Age=0; SameSite=Lax`; } catch { /* Storage may be unavailable. */ }
}
function visibleTarget(selector: string) {
  return selector.split(",").flatMap(part => [...document.querySelectorAll<HTMLElement>(part)]).find(element => {
    const rect = element.getBoundingClientRect();
    return isVisible(element) && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < innerWidth;
  });
}
function isVisible(element: HTMLElement) {
  return getComputedStyle(element).visibility !== "hidden" && (element.checkVisibility?.() ?? element.getClientRects().length > 0);
}
type Box = { left: number; top: number; width: number; height: number };

export default function OnboardingTour({ requestId = 0, onStart, onComplete, onStep, onEnd, kind = "site" }: { requestId?: number; onStart?: () => void; onComplete?: () => void; onStep?: (step: number) => void; onEnd?: () => void; kind?: "site" | "map" }) {
  const { t, n, locale } = useI18n();
  const steps = kind === "map" ? mapSteps : siteSteps;
  const storageKey = kind === "map" ? mapKey : siteKey;
  const [phase, setPhase] = useState<"welcome" | number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight?: number }>({ left: 12, top: 12 });
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const finish = useCallback(() => { rememberTour(storageKey); setPhase(null); setBox(null); }, [storageKey]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (requestId > 0) { resetTour(siteKey); resetTour(mapKey); }
      if (requestId > 0 || !hasSeenTour(storageKey)) setPhase("welcome");
    });
    return () => cancelAnimationFrame(frame);
  }, [requestId, storageKey]);

  const open = phase !== null;
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    primary.current?.focus();
    return () => {
      element?.close();
      onEnd?.();
      if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    };
  }, [open, kind, onEnd]);

  useEffect(() => {
    if (typeof phase !== "number") return;
    onStep?.(phase);
    let frame = 0;
    let target: HTMLElement | undefined;
    const measure = () => {
      const available = visibleTarget(steps[phase].target);
      if (!available) { setPhase(phase + 1); return; }
      if (available !== target) {
        if (target) observer.unobserve(target);
        target = available;
        observer.observe(target);
      }
      const rect = target.getBoundingClientRect();
      const header = kind === "site" ? document.querySelector('.topbar')?.getBoundingClientRect() : undefined;
      const safeTop = target.closest('.topbar,.sidebar') ? 6 : (header?.bottom ?? 0) + 8;
      const left = Math.max(6, rect.left - 5), top = Math.max(safeTop, rect.top - 5);
      const right = Math.min(innerWidth - 6, rect.right + 5), bottom = Math.min(innerHeight - 6, rect.bottom + 5);
      setBox({ left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
      const size = panel.current?.getBoundingClientRect();
      if (!size) return;
      const gap = 14, margin = 12;
      let x = Math.max(margin, Math.min(left, innerWidth - size.width - margin));
      let y = bottom + gap;
      if (kind === "map" && innerWidth <= 760) {
        const above = top - gap - margin, below = innerHeight - bottom - gap - margin;
        const available = Math.max(above, below);
        if (available >= 180) {
          y = below >= above ? bottom + gap : top - gap - Math.min(size.height, available);
          setPosition({ left: x, top: Math.max(margin, y), maxHeight: available });
          return;
        }
      }
      if (innerWidth > 760 && right + size.width + gap + margin < innerWidth) { x = right + gap; y = top; }
      else if (innerWidth > 760 && left - size.width - gap > margin) { x = left - size.width - gap; y = top; }
      else if (top - size.height - gap > margin) y = top - size.height - gap;
      y = Math.max(margin, Math.min(y, innerHeight - size.height - margin));
      setPosition({ left: x, top: y });
    };
    const schedule = () => { if (!target) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    const mutations = new MutationObserver(() => { if (target && !target.isConnected) schedule(); });
    const prepare = () => {
      if (phase >= steps.length) { finish(); return; }
      target = visibleTarget(steps[phase].target);
      if (!target) { setPhase(phase + 1); return; }
      if (kind === "site") target.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      else target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      if (kind === "site" && innerWidth <= 760 && !target.closest('.topbar,.sidebar')) {
        const height = panel.current?.getBoundingClientRect().height ?? 260;
        const header = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
        const rect = target.getBoundingClientRect();
        const top = header + 12 + Math.max(0, (innerHeight - header - height - 40 - rect.height) / 2);
        window.scrollBy({ top: rect.top - top, behavior: "instant" });
      }
      measure();
      primary.current?.focus({ preventScroll: true });
      observer.observe(target);
      if (panel.current) observer.observe(panel.current);
      mutations.observe(document.body, { subtree: true, childList: true });
    };
    frame = requestAnimationFrame(() => { if (onStep) frame = requestAnimationFrame(prepare); else prepare(); });
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect();
      window.removeEventListener("resize", schedule); document.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [phase, finish, locale, kind, onStep, steps]);

  if (phase === null) return null;
  const step = typeof phase === "number" ? steps[phase] : null;
  if (typeof phase === "number" && !step) return null;
  return <dialog ref={dialog} className={`tour-dialog ${kind === "map" ? "map-tools-tour" : "site-tour"}${phase === "welcome" ? " tour-welcome" : ""}`} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); finish(); }} onKeyDown={event => {
    event.stopPropagation();
    if (event.key !== "Tab") return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement as HTMLButtonElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement as HTMLButtonElement))) { event.preventDefault(); first?.focus(); }
  }}>
    {box && step ? <><svg className="tour-shade" aria-hidden="true"><path fillRule="evenodd" d={`M0 0H${innerWidth}V${innerHeight}H0Z M${box.left} ${box.top}v${box.height}h${box.width}v-${box.height}Z`} /></svg><div className="tour-highlight" aria-hidden="true" style={box} /></> : <div className="tour-shade tour-solid-shade" />}
    <section ref={panel} className="tour-panel" style={phase === "welcome" ? undefined : position} data-tour-step={typeof phase === "number" ? phase : undefined}>
      <span className="tour-symbol" aria-hidden="true">{phase === "welcome" ? <Globe2 size={28} /> : <Compass size={23} />}</span>
      <div className="tour-copy" aria-live="polite" aria-atomic="true">
        {step && <p className="tour-progress">{t("Step {step} of {total}", { step: n((phase as number) + 1), total: n(steps.length) })}</p>}
        <h2 id={titleId}>{t(step?.title ?? (kind === "map" ? "Discover your map tools" : "Welcome to Atlas"))}</h2>
        <p id={descriptionId} className="tour-description">{t(step?.description ?? (kind === "map" ? "Learn to sketch, erase, measure distances and explore roles and time in fullscreen. We will show the tools without changing your drawings or saved settings." : "Atlas helps you understand how people, places and political roles connect over time. Explore history on the world map and build your own perspective. This short tour shows you where to begin."))}</p>
      </div>
      <div className="tour-actions">
        <button type="button" className="secondary-button" onClick={finish}>{t(phase === "welcome" ? "Not now" : "Skip tour")}</button>
        <button ref={primary} type="button" className="primary-button" aria-describedby={descriptionId} onClick={() => { setBox(null); if (phase === "welcome") { onStart?.(); setPhase(0); } else if (phase >= steps.length - 1) { dialog.current?.close(); finish(); onComplete?.(); } else setPhase(phase + 1); }}>{t(phase === "welcome" ? "Start tour" : typeof phase === "number" && phase >= steps.length - 1 ? kind === "site" ? "Open map" : "Finish tour" : "Next")}<ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </section>
  </dialog>;
}
