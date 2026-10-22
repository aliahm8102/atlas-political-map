import { geoDistance, type GeoProjection } from "d3-geo";
import type { DrawingPoint } from "./map-drawing.ts";

export type MapCoordinate = [number, number];
export const EARTH_RADIUS_KM = 6371.0088;

// Invert unzoomed map coordinates, rejecting the empty area outside the globe.
// A round trip also rejects coordinates that the projection wraps elsewhere.
export function measurementCoordinate(point: DrawingPoint, projection: GeoProjection): MapCoordinate | null {
  const coordinate = projection.invert?.([point.x, point.y]);
  if (!coordinate || !coordinate.every(Number.isFinite) || Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90) return null;
  const projected = projection(coordinate);
  return projected && Math.hypot(projected[0] - point.x, projected[1] - point.y) < .01 ? coordinate : null;
}

export function measureRoute(points: MapCoordinate[]) {
  const segments = points.slice(1).map((point, index) => geoDistance(points[index], point) * EARTH_RADIUS_KM);
  return { segments, total: segments.reduce((sum, distance) => sum + distance, 0) };
}
