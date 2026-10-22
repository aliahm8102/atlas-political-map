"use client";
import { type PointerEvent, useCallback, useMemo, useRef, useEffect, useLayoutEffect, useState } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";
import { Plus, Minus, LocateFixed, Navigation, Expand, Shrink, SlidersHorizontal, Clock3, Pencil, Eraser, Hand, Ruler, Undo2, Trash2 } from "lucide-react";
import world from "@/data/world.json";
import nato from "@/data/nato.json";
import { type Person, type Settings, type Viewport, defaultViewport, MIN_MAP_ZOOM, MAX_MAP_ZOOM } from "@/lib/atlas";
import { constrainViewport as constrain, zoomViewport } from "@/lib/atlas";
import Portrait from "./portrait";
import type { MarkerPosition } from "@/lib/browser-people";
import { useMapFullscreen } from "./map-experience";
import { useI18n } from "@/components/i18n/provider";
import { mapGeometry, pinchViewport } from "@/lib/map-gestures";
import MapDrawing, { type DrawingTool } from "./map-drawing";
import { measureRoute, type MapCoordinate } from "@/lib/map-measurement";
import { useCountryHint } from "./use-country-hint";

const collection = feature(world as never, world.objects.countries as never) as unknown as FeatureCollection;
const land = { ...collection, features: collection.features.filter(f => f.properties?.name !== "Antarctica") };
const projection = geoNaturalEarth1().fitExtent([[28, 45], [972, 505]], land);
const path = geoPath(projection);
const countryNames = new Map(land.features.map(f => [String(f.id), String(f.properties?.name ?? "")]));
const countryPaths = new Map(land.features.map(f => [String(f.id), path(f) ?? ""]));
export function countryViewport(lng: number, lat: number): Viewport {
  const point = projection([lng, lat]) ?? [500, 270];
  return { k: 2.7, x: 500 - point[0] * 2.7, y: 270 - point[1] * 2.7 };
}

type Props = { positions?: Partial<Record<string, MarkerPosition>>; onMovePerson?: (id: string, position: MarkerPosition) => boolean; people: Person[]; settings: Settings; viewport: Viewport; onViewport: (v: Viewport) => void; selectedCountry: string | null; onCountry: (code: string) => void; onPerson: (person: Person) => void };
export default function MapCanvas({ positions = {}, onMovePerson, people, settings, viewport, onViewport, selectedCountry, onCountry, onPerson }: Props) {
  const { t, n, countryName, personName } = useI18n();
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const markerDrag = useRef<{ id: string; clientX: number; clientY: number; start: MarkerPosition; position: MarkerPosition; moved: boolean } | null>(null);
  const suppressClick = useRef<string | null>(null);
  const [moving, setMoving] = useState<{ id: string; position: MarkerPosition } | null>(null);
  const countryHint = useCountryHint(surface, countryNames);
  const dismissCountryHint = countryHint.dismiss;
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>(null);
  const [pencilColor, setPencilColor] = useState("#d35c37");
  const [measurement, setMeasurement] = useState<MapCoordinate[]>([]);
  const measured = measureRoute(measurement);
  const distanceLabel = (km: number) => km < 1 ? t("{distance} m", { distance: n(km * 1000, { maximumFractionDigits: 0 }) }) : t("{distance} km", { distance: n(km, { maximumFractionDigits: 2 }) });
  const { expanded, pending: fullscreenPending, toggle: toggleFullscreen, inspectorOpen, toggleInspector, showInspector, timelineOpen, toggleTimeline } = useMapFullscreen();
  const [stageSize, setStageSize] = useState({ width: 1000, height: 540 });
  const cover = expanded && (stageSize.width <= 760 || stageSize.height <= 500);
  const { scale: stageScale } = mapGeometry(stageSize.width, stageSize.height, cover);
  const latest = useRef(viewport);
  const update = useRef(onViewport);
  useLayoutEffect(() => { latest.current = viewport; update.current = onViewport; }, [viewport, onViewport]);
  const commitViewport = useCallback((next: Viewport) => {
    dismissCountryHint();
    latest.current = next;
    update.current(next);
  }, [dismissCountryHint]);
  const clusters = useMemo(() => {
    const grouped: { person: Person; x: number; y: number; people: Person[] }[] = [];
    const ordered = [...people].sort((a, b) => Number(b.role === "leader") - Number(a.role === "leader"));
    for (const person of ordered) {
      const geographic = projection([person.lng, person.lat]); if (!geographic) continue;
      const override = moving?.id === person.id ? moving.position : positions[person.id];
      const point = override ? [override.x, override.y] : geographic;
      const near = person.dataset !== "custom" && !override && grouped.find(g => g.person.dataset !== "custom" && !positions[g.person.id] && moving?.id !== g.person.id && Math.hypot(g.x - point[0], g.y - point[1]) * viewport.k * stageScale < (stageScale < .5 ? 33 : 41));
      if (near) near.people.push(person); else grouped.push({ person, x: point[0], y: point[1], people: [person] });
    }
    return grouped;
  }, [people, viewport.k, stageScale, positions, moving]);
  useEffect(() => {
    const element = surface.current; if (!element) return;
    const observer = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setStageSize({ width, height }); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = surface.current; if (!el) return;
    function wheel(event: WheelEvent) {
      if ((event.target as Element).closest(".map-controls")) return;
      event.preventDefault(); const rect = el!.getBoundingClientRect();
      const { scale, bounds } = mapGeometry(rect.width, rect.height, expanded && (rect.width <= 760 || rect.height <= 500));
      const mx = (event.clientX - rect.left - (rect.width - scale * 1000) / 2) / scale;
      const my = (event.clientY - rect.top - (rect.height - scale * 540) / 2) / scale;
      commitViewport(zoomViewport(latest.current, Math.exp(-event.deltaY * 0.0015), { x: mx, y: my }, bounds));
    }
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [expanded, commitViewport]);
  function geometry() {
    const rect = surface.current!.getBoundingClientRect();
    return { rect, ...mapGeometry(rect.width, rect.height, expanded && (rect.width <= 760 || rect.height <= 500)) };
  }
  function touchDown(event: PointerEvent<HTMLDivElement>) {
    countryHint.dismiss();
    if (event.pointerType !== "touch" || (event.target as Element).closest(".map-controls, .map-drawing")) return;
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.current.size < 2) return;
    // A second finger turns a portrait drag into a map gesture without saving it.
    if (markerDrag.current) suppressClick.current = markerDrag.current.id;
    markerDrag.current = null;
    setMoving(null);
    drag.current = null;
    for (const id of touches.current.keys()) event.currentTarget.setPointerCapture(id);
    event.stopPropagation();
  }
  function touchMove(event: PointerEvent<HTMLDivElement>) {
    if (!touches.current.has(event.pointerId)) return;
    const before = [...touches.current.values()];
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (before.length < 2) return;
    event.preventDefault();
    event.stopPropagation();
    const { rect, scale, bounds } = geometry();
    const point = (p: { x: number; y: number }) => ({ x: bounds.x + (p.x - rect.left) / scale, y: bounds.y + (p.y - rect.top) / scale });
    const after = [...touches.current.values()];
    commitViewport(pinchViewport(latest.current, [point(before[0]), point(before[1])], [point(after[0]), point(after[1])], bounds));
  }
  function touchEnd(event: PointerEvent<HTMLDivElement>) {
    const pinching = touches.current.size >= 2;
    touches.current.delete(event.pointerId);
    if (!pinching) return;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const remaining = touches.current.values().next().value;
    drag.current = remaining ? { x: remaining.x, y: remaining.y, vx: latest.current.x, vy: latest.current.y, moved: true } : null;
  }
  function moveMarker(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const current = markerDrag.current;
    if (!current) return;
    const scale = stageScale * latest.current.k;
    if (Math.hypot(event.clientX - current.clientX, event.clientY - current.clientY) > 5) current.moved = true;
    if (!current.moved) return;
    current.position = { x: Math.max(0, Math.min(1000, current.start.x + (event.clientX - current.clientX) / scale)), y: Math.max(0, Math.min(540, current.start.y + (event.clientY - current.clientY) / scale)) };
    setMoving({ id: current.id, position: current.position });
  }
  function finishMarker(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    event.stopPropagation();
    const current = markerDrag.current;
    markerDrag.current = null;
    if (current?.moved) {
      suppressClick.current = current.id;
      if (!cancelled) onMovePerson?.(current.id, current.position);
    }
    setMoving(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function zoom(factor: number) { commitViewport(zoomViewport(latest.current, factor, undefined, geometry().bounds)); }
  const markerSize = (settings.markerSize === "small" ? 29 : settings.markerSize === "large" ? 45 : 36) * (stageScale < .5 ? .8 : 1);
  return <div className="map-stage" ref={surface} tabIndex={0} role="region" aria-label={t("Interactive political map. Drag to pan, scroll or use plus and minus to zoom up to 64 times. Arrow keys pan; Home resets; Escape exits fullscreen.")} onKeyDown={event => {
    if ((event.target as HTMLElement).closest("button, input, select, textarea")) return;
    countryHint.dismiss();
    const moves: Record<string, [number, number]> = { ArrowLeft: [45, 0], ArrowRight: [-45, 0], ArrowUp: [0, 45], ArrowDown: [0, -45] };
    if (moves[event.key]) { event.preventDefault(); commitViewport(constrain({ ...viewport, x: viewport.x + moves[event.key][0], y: viewport.y + moves[event.key][1] }, geometry().bounds)); }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.4); }
    if (event.key === "-") { event.preventDefault(); zoom(1 / 1.4); }
    if (event.key === "Home") { event.preventDefault(); onViewport(defaultViewport); }
  }} onPointerDownCapture={touchDown} onPointerMoveCapture={touchMove} onPointerUpCapture={touchEnd} onPointerCancelCapture={touchEnd} onPointerDown={event => {
    if (event.button !== 0 || touches.current.size >= 2) return;
    if ((event.target as Element).closest("button, .map-controls")) return;
    countryHint.start(event);
    drag.current = { x: event.clientX, y: event.clientY, vx: viewport.x, vy: viewport.y, moved: false }; event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={event => {
    countryHint.move(event);
    const d = drag.current; if (!d) return;
    const { scale, bounds } = geometry();
    if (Math.hypot(event.clientX - d.x, event.clientY - d.y) > 4) d.moved = true;
    if (d.moved) commitViewport(constrain({ ...latest.current, x: d.vx + (event.clientX - d.x) / scale, y: d.vy + (event.clientY - d.y) / scale }, bounds));
  }} onPointerUp={event => {
    const held = countryHint.finish();
    const d = drag.current;
    if (d && !d.moved && !held) { const element = document.elementFromPoint(event.clientX, event.clientY); const code = element?.closest("[data-country]")?.getAttribute("data-country"); if (code) { showInspector(); onCountry(code); } }
    drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }} onPointerCancel={() => { drag.current = null; countryHint.dismiss(); }} onPointerLeave={countryHint.dismiss} onLostPointerCapture={event => { if (event.target === event.currentTarget) countryHint.dismiss(); }} onContextMenu={event => { if (countryHint.isHolding()) event.preventDefault(); }}>
    <svg style={{ direction: "ltr" }} className="world-map" viewBox="0 0 1000 540" preserveAspectRatio={cover ? "xMidYMid slice" : "xMidYMid meet"} aria-label={t("World political map")} role="img"><defs><pattern id="ocean-dots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.5" fill="currentColor" opacity="0.11" /></pattern><filter id="land-shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#677b71" floodOpacity="0.08" /></filter></defs><rect width="1000" height="540" fill="url(#ocean-dots)" /><g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.k})`}><path d={path(geoGraticule10()) ?? ""} className="graticule" vectorEffect="non-scaling-stroke" />{land.features.map((f, index) => <path key={String(f.id ?? index)} d={countryPaths.get(String(f.id)) ?? ""} className={`country ${selectedCountry === String(f.id) ? "selected" : ""} ${countryHint.hint?.code === String(f.id) ? "country-preview" : ""}`} data-country={String(f.id)} aria-label={countryName(f.properties?.name ?? "")} vectorEffect="non-scaling-stroke"></path>)}{settings.nato && <path d={path(nato as FeatureCollection) ?? ""} className="nato-layer" vectorEffect="non-scaling-stroke" />}{settings.labels && viewport.k <= 4 && <g className="continent-labels" aria-hidden="true"><text x="204" y="185">{t("NORTH AMERICA")}</text><text x="319" y="356">{t("SOUTH AMERICA")}</text><text x="520" y="156">{t("EUROPE")}</text><text x="540" y="305">{t("AFRICA")}</text><text x="719" y="203">{t("ASIA")}</text><text x="835" y="422">{t("OCEANIA")}</text></g>}{clusters.map(({ person, x, y, people: cluster }) => <g key={person.id} transform={`translate(${x},${y}) scale(${1 / (viewport.k * stageScale)})`}><foreignObject x={-markerSize / 2 - 5} y={-markerSize / 2 - 5} width={markerSize + 18} height={markerSize + 18} overflow="visible"><button style={{ width: markerSize, height: markerSize }} className={`map-pin ${selectedCountry === person.countryCode ? "active" : ""}`} data-role={person.role} data-person-id={person.id} data-draggable={Boolean(onMovePerson)} aria-describedby={onMovePerson ? "marker-drag-help" : undefined}
      onDragStart={event => event.preventDefault()}
      onPointerDown={event => {
        if (!onMovePerson || event.button !== 0 || !event.isPrimary) return;
        event.stopPropagation(); suppressClick.current = null;
        markerDrag.current = { id: person.id, clientX: event.clientX, clientY: event.clientY, start: { x, y }, position: { x, y }, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={moveMarker} onPointerUp={event => finishMarker(event)} onPointerCancel={event => finishMarker(event, true)}
      onKeyDown={event => {
        const direction: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!onMovePerson || !direction[event.key]) return;
        event.preventDefault(); event.stopPropagation();
        const step = 8 / (stageScale * viewport.k);
        onMovePerson(person.id, { x: Math.max(0, Math.min(1000, x + direction[event.key][0] * step)), y: Math.max(0, Math.min(540, y + direction[event.key][1] * step)) });
      }}
      onClick={event => { event.stopPropagation(); if (suppressClick.current === person.id && event.detail !== 0) { suppressClick.current = null; return; } showInspector(); onPerson(person); }} aria-label={t("{name}, {country}{nearby}", { name: personName(person.name), country: countryName(person.country), nearby: cluster.length > 1 ? t(", {count} figures nearby", { count: cluster.length }) : "" })} title={`${personName(person.name)} · ${countryName(person.country)}${cluster.length > 1 ? t(" (+{count} nearby)", { count: cluster.length - 1 }) : ""}`}>
      {settings.portraits ? <Portrait key={person.id} person={person} /> : <span className="pin-dot" />}{cluster.length > 1 && <span className="cluster-count">{n(cluster.length)}</span>}
    </button></foreignObject></g>)}</g></svg>
    <MapDrawing tool={expanded && drawingOpen ? drawingTool : null} color={pencilColor} measurement={measurement} onMeasure={coordinate => setMeasurement(points => [...points, coordinate])} projection={projection} viewport={viewport} onViewport={commitViewport} cover={cover} />
    <p className="sr-only" id="marker-drag-help">{t("Drag portraits to move them. Use arrow keys on a focused portrait.")}</p>{countryHint.hint && <div id="map-country-tooltip" className="map-country-tooltip" role="tooltip">{countryName(countryHint.hint.name)}</div>}<div className="map-controls">{expanded && <>
      <button className="map-control" aria-label={t("Drawing tools")} title={t("Drawing tools")} aria-expanded={drawingOpen} aria-controls="map-drawing-tools" aria-pressed={drawingOpen} onClick={() => { setDrawingOpen(!drawingOpen); setDrawingTool(drawingOpen ? null : "pencil"); }}><Pencil size={17} /></button>
      <div id="map-drawing-tools" className="map-drawing-tools" hidden={!drawingOpen} role="group" aria-label={t("Drawing tools")}>
        <button className="map-control" aria-label={t("Pencil")} title={t("Pencil")} aria-pressed={drawingTool === "pencil"} onClick={() => setDrawingTool("pencil")}><Pencil size={17} /></button>
        <button className="map-control" aria-label={t("Erase pencil strokes")} title={t("Erase pencil strokes")} aria-pressed={drawingTool === "eraser"} onClick={() => setDrawingTool("eraser")}><Eraser size={17} /></button>
        <button className="map-control" aria-label={t("Measure distance")} title={t("Measure distance")} aria-pressed={drawingTool === "ruler"} onClick={() => setDrawingTool("ruler")}><Ruler size={17} /></button>
        <button className="map-control" aria-label={t("Pan map")} title={t("Pan map")} aria-pressed={drawingTool === null} onClick={() => setDrawingTool(null)}><Hand size={17} /></button>
        {drawingTool === "pencil" && <div className="map-pencil-colors" role="group" aria-label={t("Pencil color")}>
          {([ ["#d35c37", "Orange"], ["#2563eb", "Blue"], ["#16a34a", "Green"], ["#9333ea", "Purple"], ["#202a25", "Black"], ["#ffffff", "White"] ] as const).map(([color, name]) => <button key={color} className="pencil-color" style={{ backgroundColor: color }} aria-label={t(name)} title={t(name)} aria-pressed={pencilColor === color} onClick={() => setPencilColor(color)} />)}
          <label className="pencil-custom-color" title={t("Custom pencil color")}><span className="sr-only">{t("Custom pencil color")}</span><input type="color" value={pencilColor} onChange={event => setPencilColor(event.target.value)} /></label>
        </div>}
        {drawingTool === "ruler" && <div className="map-measurement">
          <p>{t("Tap the map to add measurement points.")}</p>
          <output aria-live="polite" aria-atomic="true" data-measurement-total={measured.total}>{t("Total distance")}: <strong>{distanceLabel(measured.total)}</strong></output>
          <small>{t("Approximate surface distance")}</small>
          {measurement.length > 0 && <span>{t("{count} points", { count: n(measurement.length) })}</span>}
          {measured.segments.length > 0 && <ol aria-label={t("Distance segments")}>{measured.segments.map((km, index) => <li key={index}><span>{n(index + 1)} → {n(index + 2)}</span><strong>{distanceLabel(km)}</strong></li>)}</ol>}
          <div className="measurement-actions"><button type="button" aria-label={t("Undo measurement point")} title={t("Undo measurement point")} disabled={!measurement.length} onClick={() => setMeasurement(points => points.slice(0, -1))}><Undo2 size={16} />{t("Undo")}</button><button type="button" aria-label={t("Clear measurement")} title={t("Clear measurement")} disabled={!measurement.length} onClick={() => setMeasurement([])}><Trash2 size={16} />{t("Clear")}</button></div>
        </div>}
      </div>
    </>}{expanded && <button className="map-control" aria-label={timelineOpen ? t("Hide timeline") : t("Show timeline")} title={timelineOpen ? t("Hide timeline") : t("Show timeline")} aria-expanded={timelineOpen} aria-controls="map-timeline" onClick={toggleTimeline}><Clock3 size={17} /></button>}{expanded && <button className="map-control" aria-label={t("Map controls")} title={t("Map controls")} aria-expanded={inspectorOpen} onClick={toggleInspector}><SlidersHorizontal size={17} /></button>}<button className="map-control" aria-label={t("Zoom in")} disabled={viewport.k >= MAX_MAP_ZOOM} onClick={() => zoom(1.4)}><Plus size={18} /></button><button className="map-control" aria-label={t("Zoom out")} disabled={viewport.k <= MIN_MAP_ZOOM} onClick={() => zoom(1 / 1.4)}><Minus size={18} /></button><span /><button className="map-control" aria-label={t("Reset map position")} onClick={() => { countryHint.dismiss(); onViewport(defaultViewport); }}><LocateFixed size={18} /></button><button className="map-control" aria-label={expanded ? t("Exit fullscreen") : t("Enter fullscreen")} title={expanded ? t("Exit fullscreen (Esc)") : t("Fullscreen map")} aria-pressed={expanded} disabled={fullscreenPending} onClick={toggleFullscreen}>{expanded ? <Shrink size={17} /> : <Expand size={17} />}</button></div><div className="map-compass" aria-hidden="true"><span>{t("N")}</span><Navigation size={22} strokeWidth={1.4} /></div><span className="map-scale">{n(viewport.k, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}× <i /></span>{people.length === 0 && <div className="map-empty">{t("No figures match this view.")}<br /><span>{t("Try another date or clear your filters.")}</span></div>}
  </div>;
}
