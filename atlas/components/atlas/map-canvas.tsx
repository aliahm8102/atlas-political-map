"use client";
import { useMemo, useRef, useEffect, useLayoutEffect, useState } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";
import { Plus, Minus, LocateFixed, Navigation, Expand, Shrink, Globe2 } from "lucide-react";
import world from "@/data/world.json";
import nato from "@/data/nato.json";
import { type Person, type Settings, type Viewport, defaultViewport, MIN_MAP_ZOOM, MAX_MAP_ZOOM } from "@/lib/atlas";
import { constrainViewport as constrain, zoomViewport } from "@/lib/atlas";
import Portrait from "./portrait";
import { useI18n } from "@/components/i18n/provider";

const collection = feature(world as never, world.objects.countries as never) as unknown as FeatureCollection;
const land = { ...collection, features: collection.features.filter(f => f.properties?.name !== "Antarctica") };
const projection = geoNaturalEarth1().fitExtent([[28, 45], [972, 505]], land);
const path = geoPath(projection);
export function countryViewport(lng: number, lat: number): Viewport {
  const point = projection([lng, lat]) ?? [500, 270];
  return { k: 2.7, x: 500 - point[0] * 2.7, y: 270 - point[1] * 2.7 };
}

type Props = { people: Person[]; settings: Settings; viewport: Viewport; onViewport: (v: Viewport) => void; selectedCountry: string | null; onCountry: (code: string) => void; onPerson: (person: Person) => void };
export default function MapCanvas({ people, settings, viewport, onViewport, selectedCountry, onCountry, onPerson }: Props) {
  const { t, n, countryName, personName } = useI18n();
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const [hovered, setHovered] = useState("");
  const [fallbackExpanded, setFallbackExpanded] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fullscreenPending, setFullscreenPending] = useState(false);
  const expanded = nativeFullscreen || fallbackExpanded;
  const [stageScale, setStageScale] = useState(1);
  const latest = useRef(viewport);
  const update = useRef(onViewport);
  useLayoutEffect(() => { latest.current = viewport; update.current = onViewport; }, [viewport, onViewport]);
  useEffect(() => {
    const element = surface.current;
    const syncFullscreen = () => setNativeFullscreen(document.fullscreenElement === element);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  async function toggleFullscreen() {
    const element = surface.current;
    if (!element || fullscreenPending) return;
    if (fallbackExpanded) { setFallbackExpanded(false); return; }
    setFullscreenPending(true);
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else if (element.requestFullscreen && document.fullscreenEnabled) await element.requestFullscreen();
      else setFallbackExpanded(true);
    } catch {
      if (document.fullscreenElement !== element) setFallbackExpanded(true);
    } finally { setFullscreenPending(false); }
  }
  const clusters = useMemo(() => {
    const grouped: { person: Person; x: number; y: number; people: Person[] }[] = [];
    const ordered = [...people].sort((a, b) => Number(b.role === "leader") - Number(a.role === "leader"));
    for (const person of ordered) {
      const point = projection([person.lng, person.lat]); if (!point) continue;
      const near = grouped.find(g => Math.hypot(g.x - point[0], g.y - point[1]) * viewport.k * stageScale < (stageScale < .5 ? 33 : 41));
      if (near) near.people.push(person); else grouped.push({ person, x: point[0], y: point[1], people: [person] });
    }
    return grouped;
  }, [people, viewport.k, stageScale]);
  useEffect(() => {
    const element = surface.current; if (!element) return;
    const observer = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setStageScale(Math.max(.1, Math.min(width / 1000, height / 540))); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = surface.current; if (!el) return;
    function wheel(event: WheelEvent) {
      event.preventDefault(); const rect = el!.getBoundingClientRect();
      const scale = Math.min(rect.width / 1000, rect.height / 540);
      const mx = (event.clientX - rect.left - (rect.width - scale * 1000) / 2) / scale;
      const my = (event.clientY - rect.top - (rect.height - scale * 540) / 2) / scale;
      update.current(zoomViewport(latest.current, Math.exp(-event.deltaY * 0.0015), { x: mx, y: my }));
    }
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  function zoom(factor: number) { onViewport(zoomViewport(viewport, factor)); }
  const markerSize = (settings.markerSize === "small" ? 29 : settings.markerSize === "large" ? 45 : 36) * (stageScale < .5 ? .8 : 1);
  return <div className={`map-stage ${expanded ? "map-expanded" : ""}`} data-fullscreen={nativeFullscreen ? "native" : fallbackExpanded ? "fallback" : "off"} ref={surface} tabIndex={0} role="region" aria-label={t("Interactive political map. Drag to pan, scroll or use plus and minus to zoom up to 64 times. Arrow keys pan; Home resets; Escape exits fullscreen.")} onKeyDown={event => {
    if (event.key === "Escape") {
      if (document.fullscreenElement === surface.current) void document.exitFullscreen().catch(() => {});
      setFallbackExpanded(false); return;
    }
    if ((event.target as HTMLElement).closest("button")) return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [45, 0], ArrowRight: [-45, 0], ArrowUp: [0, 45], ArrowDown: [0, -45] };
    if (moves[event.key]) { event.preventDefault(); onViewport(constrain({ ...viewport, x: viewport.x + moves[event.key][0], y: viewport.y + moves[event.key][1] })); }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.4); }
    if (event.key === "-") { event.preventDefault(); zoom(1 / 1.4); }
    if (event.key === "Home") { event.preventDefault(); onViewport(defaultViewport); }
  }} onPointerDown={event => {
    if ((event.target as Element).closest("button")) return;
    drag.current = { x: event.clientX, y: event.clientY, vx: viewport.x, vy: viewport.y, moved: false }; event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={event => {
    const d = drag.current; if (!d) return;
    const rect = event.currentTarget.getBoundingClientRect(); const scale = Math.min(rect.width / 1000, rect.height / 540);
    if (Math.hypot(event.clientX - d.x, event.clientY - d.y) > 4) d.moved = true;
    if (d.moved) onViewport(constrain({ ...latest.current, x: d.vx + (event.clientX - d.x) / scale, y: d.vy + (event.clientY - d.y) / scale }));
  }} onPointerUp={event => {
    const d = drag.current;
    if (d && !d.moved) { const element = document.elementFromPoint(event.clientX, event.clientY); const code = element?.closest("[data-country]")?.getAttribute("data-country"); if (code) onCountry(code); }
    drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }} onPointerCancel={() => { drag.current = null; }}>
    <svg style={{ direction: "ltr" }} className="world-map" viewBox="0 0 1000 540" aria-label={t("World political map")} role="img"><defs><pattern id="ocean-dots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.5" fill="currentColor" opacity="0.11" /></pattern><filter id="land-shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#677b71" floodOpacity="0.08" /></filter></defs><rect width="1000" height="540" fill="url(#ocean-dots)" /><g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.k})`}><path d={path(geoGraticule10()) ?? ""} className="graticule" vectorEffect="non-scaling-stroke" />{land.features.map((f, index) => <path key={String(f.id ?? index)} d={path(f) ?? ""} className={`country ${selectedCountry === String(f.id) ? "selected" : ""}`} data-country={String(f.id)} onPointerEnter={() => setHovered(f.properties?.name ?? "")} onPointerLeave={() => setHovered("")} vectorEffect="non-scaling-stroke"><title>{countryName(f.properties?.name ?? "")}</title></path>)}{settings.nato && <path d={path(nato as FeatureCollection) ?? ""} className="nato-layer" vectorEffect="non-scaling-stroke" />}{settings.labels && viewport.k <= 4 && <g className="continent-labels" aria-hidden="true"><text x="204" y="185">{t("NORTH AMERICA")}</text><text x="319" y="356">{t("SOUTH AMERICA")}</text><text x="520" y="156">{t("EUROPE")}</text><text x="540" y="305">{t("AFRICA")}</text><text x="719" y="203">{t("ASIA")}</text><text x="835" y="422">{t("OCEANIA")}</text></g>}{clusters.map(({ person, x, y, people: cluster }) => <g key={person.id} transform={`translate(${x},${y}) scale(${1 / (viewport.k * stageScale)})`}><foreignObject x={-markerSize / 2 - 5} y={-markerSize / 2 - 5} width={markerSize + 18} height={markerSize + 18} overflow="visible"><button style={{ width: markerSize, height: markerSize }} className={`map-pin ${selectedCountry === person.countryCode ? "active" : ""}`} data-role={person.role} onClick={event => { event.stopPropagation(); onPerson(person); }} aria-label={t("{name}, {country}{nearby}", { name: personName(person.name), country: countryName(person.country), nearby: cluster.length > 1 ? t(", {count} figures nearby", { count: cluster.length }) : "" })} title={`${personName(person.name)} · ${countryName(person.country)}${cluster.length > 1 ? t(" (+{count} nearby)", { count: cluster.length - 1 }) : ""}`}>
      {settings.portraits ? <Portrait key={person.id} person={person} /> : <span className="pin-dot" />}{cluster.length > 1 && <span className="cluster-count">{n(cluster.length)}</span>}
    </button></foreignObject></g>)}</g></svg>
    <div className="map-coordinate"><Globe2 size={13} /><span>{hovered ? countryName(hovered) : t("Discover a different perspective")}</span></div><div className="map-controls"><button className="map-control" aria-label={t("Zoom in")} disabled={viewport.k >= MAX_MAP_ZOOM} onClick={() => zoom(1.4)}><Plus size={18} /></button><button className="map-control" aria-label={t("Zoom out")} disabled={viewport.k <= MIN_MAP_ZOOM} onClick={() => zoom(1 / 1.4)}><Minus size={18} /></button><span /><button className="map-control" aria-label={t("Reset map position")} onClick={() => onViewport(defaultViewport)}><LocateFixed size={18} /></button><button className="map-control" aria-label={expanded ? t("Exit fullscreen") : t("Enter fullscreen")} title={expanded ? t("Exit fullscreen (Esc)") : t("Fullscreen map")} aria-pressed={expanded} disabled={fullscreenPending} onClick={toggleFullscreen}>{expanded ? <Shrink size={17} /> : <Expand size={17} />}</button></div><div className="map-compass" aria-hidden="true"><span>{t("N")}</span><Navigation size={22} strokeWidth={1.4} /></div><div className="map-legend"><span><i className="legend-dot leader" />{" " + t("Heads of state")}</span><span><i className="legend-dot member" />{" " + t("Government")}</span><span><i className="legend-dot army" />{" " + t("Military")}</span><span className="legend-more">{t("+ religious & business")}</span></div><span className="map-scale">{n(viewport.k, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}× <i /></span>{people.length === 0 && <div className="map-empty">{t("No figures match this view.")}<br /><span>{t("Try another date or clear your filters.")}</span></div>}
  </div>;
}
