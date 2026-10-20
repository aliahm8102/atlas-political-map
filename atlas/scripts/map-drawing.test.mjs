import test from "node:test";
import assert from "node:assert/strict";
import { erasePencilStrokes, pencilPath } from "../lib/map-drawing.ts";

const stroke = (id, points) => ({ id, points: points.map(([x, y]) => ({ x, y })) });

test("eraser removes a crossed pencil stroke between sampled points, preserving nearby drawings", () => {
  const crossed = stroke(1, [[0, 0], [100, 0]]);
  const untouched = stroke(2, [[0, 40], [100, 40]]);
  const strokes = [crossed, untouched];
  assert.deepEqual(erasePencilStrokes(strokes, { x: 50, y: -20 }, { x: 50, y: 20 }, 5), [untouched]);
  assert.deepEqual(strokes, [crossed, untouched], "Erasing never mutates the input collection");
});

test("eraser uses its radius for dots, parallel strokes and end caps", () => {
  const dot = stroke(1, [[10, 10]]);
  const line = stroke(2, [[50, 10], [100, 10]]);
  assert.deepEqual(erasePencilStrokes([dot, line], { x: 10, y: 13 }, { x: 10, y: 13 }, 4), [line]);
  assert.deepEqual(erasePencilStrokes([line], { x: 45, y: 10 }, { x: 45, y: 10 }, 5), []);
  assert.deepEqual(erasePencilStrokes([line], { x: 60, y: 13 }, { x: 90, y: 13 }, 4), []);
  assert.deepEqual(erasePencilStrokes([line], { x: 60, y: 20 }, { x: 90, y: 20 }, 4), [line]);
});

test("swept erasing catches fast and collinear passes without removing distant strokes", () => {
  const line = stroke(1, [[100, 100], [200, 100]]);
  assert.deepEqual(erasePencilStrokes([line], { x: 0, y: 100 }, { x: 300, y: 100 }, 1), []);
  assert.deepEqual(erasePencilStrokes([line], { x: 0, y: 0 }, { x: 0, y: 300 }, 14), [line]);
  assert.deepEqual(erasePencilStrokes([], { x: 0, y: 0 }, { x: 1, y: 1 }, 14), []);
});

test("pencil paths include single-point taps and preserve map coordinates", () => {
  assert.equal(pencilPath([]), "");
  assert.match(pencilPath([{ x: 12, y: 34 }]), /^M12,34 l/);
  assert.equal(pencilPath([{ x: 12, y: 34 }, { x: 56, y: 78 }]), "M12,34 L56,78");
});
