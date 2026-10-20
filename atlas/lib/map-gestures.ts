import { constrainViewport, MAX_MAP_ZOOM, MIN_MAP_ZOOM, type Viewport } from "./atlas.ts";

type Point = { x: number; y: number };

// Match the SVG's centered meet/slice transform, including its cropped area.
export function mapGeometry(width: number, height: number, cover = false) {
  const scale = Math.max(.001, (cover ? Math.max : Math.min)(width / 1000, height / 540));
  const bounds = { x: (1000 - width / scale) / 2, y: (540 - height / scale) / 2, width: width / scale, height: height / scale };
  return { scale, bounds };
}

export function pinchViewport(view: Viewport, before: [Point, Point], after: [Point, Point], bounds: ReturnType<typeof mapGeometry>["bounds"]): Viewport {
  const distance = (points: [Point, Point]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const previousDistance = distance(before);
  if (previousDistance < 1) return view;
  const midpoint = (points: [Point, Point]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
  const start = midpoint(before), end = midpoint(after);
  const k = Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, view.k * distance(after) / previousDistance));
  return constrainViewport({ k, x: end.x - (start.x - view.x) * k / view.k, y: end.y - (start.y - view.y) * k / view.k }, bounds);
}
