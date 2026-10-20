"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import type { Viewport } from "@/lib/atlas";
import { erasePencilStrokes, pencilPath, type DrawingPoint, type PencilStroke } from "@/lib/map-drawing";
import { mapGeometry, pinchViewport } from "@/lib/map-gestures";
import { useI18n } from "@/components/i18n/provider";

export type DrawingTool = "pencil" | "eraser" | null;

export default function MapDrawing({ tool, viewport, onViewport, cover }: { tool: DrawingTool; viewport: Viewport; onViewport: (view: Viewport) => void; cover: boolean }) {
  const { t } = useI18n();
  const svg = useRef<SVGSVGElement>(null);
  const ink = useRef<SVGGElement>(null);
  const [strokes, setStrokes] = useState<PencilStroke[]>([]);
  const [draft, setDraft] = useState<PencilStroke | null>(null);
  const active = useRef<{ id: number; points: DrawingPoint[] } | null>(null);
  const contacts = useRef(new Map<number, DrawingPoint>());
  const pinching = useRef(false);
  const previous = useRef<DrawingPoint | null>(null);
  const nextId = useRef(0);
  const currentView = useRef(viewport);
  useLayoutEffect(() => { currentView.current = viewport; }, [viewport]);
  useEffect(() => {
    active.current = null;
    previous.current = null;
    contacts.current.clear();
    pinching.current = false;
    setDraft(null);
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
      active.current = null; previous.current = null; setDraft(null);
      return;
    }
    const start = point(event);
    if (tool === "pencil") {
      active.current = { id: event.pointerId, points: [start] };
      setDraft({ id: -1, points: [start] });
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
    const end = point(event);
    if (tool === "pencil" && active.current?.id === event.pointerId) {
      const points = [...active.current.points, end];
      active.current.points = points;
      setDraft({ id: -1, points });
    } else if (tool === "eraser" && previous.current) { erase(previous.current, end); previous.current = end; }
  }
  function finish(event: PointerEvent<SVGSVGElement>, cancelled = false) {
    if (!contacts.current.has(event.pointerId)) return;
    event.preventDefault(); event.stopPropagation();
    if (active.current?.id === event.pointerId) {
      if (!cancelled && !pinching.current) {
        const stroke = { id: nextId.current++, points: [...active.current.points, point(event)] };
        setStrokes(strokes => [...strokes, stroke]);
      }
      active.current = null; setDraft(null);
    }
    contacts.current.delete(event.pointerId);
    previous.current = null;
    if (!contacts.current.size) pinching.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <svg ref={svg} className="map-drawing" data-drawing-tool={tool ?? "pan"} viewBox="0 0 1000 540" preserveAspectRatio={cover ? "xMidYMid slice" : "xMidYMid meet"} style={{ pointerEvents: tool ? "auto" : "none", direction: "ltr" }} aria-label={t("Pencil drawings on the map")} role="img" onPointerDown={down} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)} onClick={event => event.stopPropagation()} onContextMenu={event => { if (tool) event.preventDefault(); }}>
    <g ref={ink} transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.k})`} fill="none" stroke="#d35c37" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
      {strokes.map(stroke => <path key={stroke.id} data-pencil-stroke={stroke.id} d={pencilPath(stroke.points)} vectorEffect="non-scaling-stroke" />)}
      {draft && <path d={pencilPath(draft.points)} vectorEffect="non-scaling-stroke" />}
    </g>
  </svg>;
}
