"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import type { Viewport } from "@/lib/atlas";
import { erasePencilStrokes, pencilPath, type DrawingPoint, type PencilStroke } from "@/lib/map-drawing";
import { mapGeometry, pinchViewport } from "@/lib/map-gestures";
import { useI18n } from "@/components/i18n/provider";
import { geoPath, type GeoProjection } from "d3-geo";
import { measurementCoordinate, type MapCoordinate } from "@/lib/map-measurement";

export type DrawingTool = "pencil" | "eraser" | "ruler" | null;

export default function MapDrawing({ tool, color, measurement, onMeasure, projection, viewport, onViewport, cover }: { tool: DrawingTool; color: string; measurement: MapCoordinate[]; onMeasure: (coordinate: MapCoordinate) => void; projection: GeoProjection; viewport: Viewport; onViewport: (view: Viewport) => void; cover: boolean }) {
  const { t, n } = useI18n();
  const svg = useRef<SVGSVGElement>(null);
  const ink = useRef<SVGGElement>(null);
  const [strokes, setStrokes] = useState<PencilStroke[]>([]);
  const [draft, setDraft] = useState<PencilStroke | null>(null);
  const active = useRef<{ id: number; points: DrawingPoint[]; color: string } | null>(null);
  const tap = useRef<{ id: number; start: DrawingPoint; moved: boolean } | null>(null);
  const [previousTool, setPreviousTool] = useState(tool);
  // A new tool cancels the visible draft before paint, preserving committed ink.
  if (previousTool !== tool) { setPreviousTool(tool); setDraft(null); }
  const contacts = useRef(new Map<number, DrawingPoint>());
  const pinching = useRef(false);
  const previous = useRef<DrawingPoint | null>(null);
  const nextId = useRef(0);
  const currentView = useRef(viewport);
  useLayoutEffect(() => { currentView.current = viewport; }, [viewport]);
  useEffect(() => {
    active.current = null;
    tap.current = null;
    previous.current = null;
    contacts.current.clear();
    pinching.current = false;
  }, [tool]);

  function point(event: PointerEvent<SVGSVGElement>) {
    const matrix = ink.current!.getScreenCTM()!;
    const screen = new DOMPoint(event.clientX, event.clientY);
    const local = screen.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  }
  function erase(from: DrawingPoint, to: DrawingPoint) {
    const matrix = ink.current!.getScreenCTM()!;
    const radius = 14 / Math.hypot(matrix.a, matrix.b);
    setStrokes(strokes => erasePencilStrokes(strokes, from, to, radius));
  }
  function down(event: PointerEvent<SVGSVGElement>) {
    if (!tool || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    contacts.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (contacts.current.size > 1) {
      pinching.current = true;
      active.current = null; tap.current = null; previous.current = null; setDraft(null);
      return;
    }
    const start = point(event);
    if (tool === "pencil") {
      active.current = { id: event.pointerId, points: [start], color };
      setDraft({ id: -1, points: [start], color });
    } else if (tool === "ruler") {
      tap.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, moved: false };
    } else { previous.current = start; erase(start, start); }
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (!contacts.current.has(event.pointerId)) return;
    event.preventDefault(); event.stopPropagation();
    const before = [...contacts.current.values()];
    contacts.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (before.length >= 2) {
      const after = [...contacts.current.values()];
      const rect = svg.current!.getBoundingClientRect();
      const { scale, bounds } = mapGeometry(rect.width, rect.height, cover);
      const local = (p: DrawingPoint) => ({ x: bounds.x + (p.x - rect.left) / scale, y: bounds.y + (p.y - rect.top) / scale });
      const next = pinchViewport(currentView.current, [local(before[0]), local(before[1])], [local(after[0]), local(after[1])], bounds);
      currentView.current = next; onViewport(next);
      return;
    }
    if (pinching.current) return;
    if (tap.current?.id === event.pointerId && Math.hypot(event.clientX - tap.current.start.x, event.clientY - tap.current.start.y) > 8) tap.current.moved = true;
    const end = point(event);
    if (tool === "pencil" && active.current?.id === event.pointerId) {
      const points = [...active.current.points, end];
      active.current.points = points;
      setDraft({ id: -1, points, color: active.current.color });
    } else if (tool === "eraser" && previous.current) { erase(previous.current, end); previous.current = end; }
  }
  function finish(event: PointerEvent<SVGSVGElement>, cancelled = false) {
    if (!contacts.current.has(event.pointerId)) return;
    event.preventDefault(); event.stopPropagation();
    if (active.current?.id === event.pointerId) {
      if (!cancelled && !pinching.current) {
        const stroke = { id: nextId.current++, points: [...active.current.points, point(event)], color: active.current.color };
        setStrokes(strokes => [...strokes, stroke]);
      }
      active.current = null; setDraft(null);
    }
    if (tap.current?.id === event.pointerId) {
      if (!cancelled && !pinching.current && !tap.current.moved && Math.hypot(event.clientX - tap.current.start.x, event.clientY - tap.current.start.y) <= 8) {
        const coordinate = measurementCoordinate(point(event), projection);
        if (coordinate) onMeasure(coordinate);
      }
      tap.current = null;
    }
    contacts.current.delete(event.pointerId);
    previous.current = null;
    if (!contacts.current.size) pinching.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <svg ref={svg} className="map-drawing" data-drawing-tool={tool ?? "pan"} viewBox="0 0 1000 540" preserveAspectRatio={cover ? "xMidYMid slice" : "xMidYMid meet"} style={{ pointerEvents: tool ? "auto" : "none", direction: "ltr" }} aria-label={t("Pencil drawings on the map")} role="img" onPointerDown={down} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)} onClick={event => event.stopPropagation()} onContextMenu={event => { if (tool) event.preventDefault(); }}>
    <g ref={ink} transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.k})`} fill="none" stroke="#d35c37" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
      {strokes.map(stroke => <path key={stroke.id} data-pencil-stroke={stroke.id} stroke={stroke.color} d={pencilPath(stroke.points)} vectorEffect="non-scaling-stroke" />)}
      {draft && <path stroke={draft.color} d={pencilPath(draft.points)} vectorEffect="non-scaling-stroke" />}
      {measurement.length > 1 && <path data-measurement-path="" d={geoPath(projection)({ type: "LineString", coordinates: measurement }) ?? ""} stroke="#2563eb" strokeWidth="3" strokeDasharray="7 4" vectorEffect="non-scaling-stroke" />}
      {measurement.map((coordinate, index) => {
        const position = projection(coordinate);
        if (!position) return null;
        return <g key={index} data-measurement-point={index} transform={`translate(${position[0]},${position[1]}) scale(${1 / viewport.k})`}>
          <circle r="7" fill="#ffffff" stroke="#2563eb" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <text y="-12" textAnchor="middle" stroke="#ffffff" strokeWidth="3" paintOrder="stroke" fill="#1e40af" fontSize="15">{n(index + 1)}</text>
        </g>;
      })}
    </g>
  </svg>;
}
