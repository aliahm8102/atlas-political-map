export type DrawingPoint = { x: number; y: number };
export type PencilStroke = { id: number; points: DrawingPoint[]; color?: string };

function pointDistance(point: DrawingPoint, start: DrawingPoint, end: DrawingPoint) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length)) : 0;
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
}

function segmentsNear(a: DrawingPoint, b: DrawingPoint, c: DrawingPoint, d: DrawingPoint, radius: number) {
  const cross = (p: DrawingPoint, q: DrawingPoint, r: DrawingPoint) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  if (((abC < 0 && abD > 0) || (abC > 0 && abD < 0)) && ((cdA < 0 && cdB > 0) || (cdA > 0 && cdB < 0))) return true;
  return Math.min(pointDistance(a, c, d), pointDistance(b, c, d), pointDistance(c, a, b), pointDistance(d, a, b)) <= radius;
}

// Only pencil data enters this function. Geography, portraits and map layers
// are separate SVG elements and can never be deleted by the eraser.
export function erasePencilStrokes(strokes: PencilStroke[], from: DrawingPoint, to: DrawingPoint, radius: number): PencilStroke[] {
  return strokes.filter(stroke => !stroke.points.some((point, index) => segmentsNear(from, to, point, stroke.points[Math.max(0, index - 1)], radius)));
}

export function pencilPath(points: DrawingPoint[]) {
  if (!points.length) return "";
  return points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ") + (points.length === 1 ? " l0.001,0" : "");
}
