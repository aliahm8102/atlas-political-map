import test from "node:test";
import assert from "node:assert/strict";
import { mapGeometry, pinchViewport } from "../lib/map-gestures.ts";
import { constrainViewport, defaultViewport, MAX_MAP_ZOOM } from "../lib/atlas.ts";

test("phone fullscreen fills portrait and landscape while keeping the map centered", () => {
  for (const [width, height] of [[320, 640], [390, 844], [844, 390]]) {
    const { scale, bounds } = mapGeometry(width, height, true);
    assert.ok(scale * 1000 >= width && scale * 540 >= height);
    assert.equal(bounds.x + bounds.width / 2, 500);
    assert.equal(bounds.y + bounds.height / 2, 270);
    assert.ok(Math.abs(bounds.width * scale - width) < 1e-9);
    assert.ok(Math.abs(bounds.height * scale - height) < 1e-9);
  }
});

test("a cropped phone map can pan to both edges even at its initial zoom", () => {
  const { bounds } = mapGeometry(390, 844, true);
  const east = constrainViewport({ ...defaultViewport, x: -10000 }, bounds);
  const west = constrainViewport({ ...defaultViewport, x: 10000 }, bounds);
  assert.ok(east.x < -300 && west.x > 300);
  assert.equal(east.x + 1000, bounds.x + bounds.width - 80);
  assert.equal(west.x, bounds.x + 80);
});

test("letterboxed maps keep their original pan limits and reset position", () => {
  for (const [width, height] of [[390, 273], [1440, 1080], [844, 390]]) {
    const { bounds } = mapGeometry(width, height);
    assert.deepEqual(constrainViewport(defaultViewport, bounds), defaultViewport);
    assert.deepEqual(constrainViewport({ k: 1, x: 10000, y: -10000 }, bounds), { k: 1, x: 80, y: -80 });
  }
});

test("pinching zooms in and out around the fingers and supports two-finger panning", () => {
  const { bounds } = mapGeometry(390, 844, true);
  const before = [{ x: 450, y: 240 }, { x: 550, y: 300 }];
  const after = [{ x: 420, y: 220 }, { x: 620, y: 340 }];
  const zoomed = pinchViewport(defaultViewport, before, after, bounds);
  assert.equal(zoomed.k, 2);
  assert.equal((520 - zoomed.x) / zoomed.k, 500);
  assert.equal((280 - zoomed.y) / zoomed.k, 270);
  assert.deepEqual(pinchViewport(zoomed, after, before, bounds), defaultViewport);
  const panned = pinchViewport(defaultViewport, before, before.map(p => ({ x: p.x + 30, y: p.y + 20 })), bounds);
  assert.deepEqual(panned, { k: 1, x: 30, y: 20 });
});

test("pinch limits stay finite at coincident touches and both zoom limits", () => {
  const { bounds } = mapGeometry(390, 844, true);
  const near = [{ x: 499, y: 270 }, { x: 501, y: 270 }];
  const far = [{ x: 100, y: 270 }, { x: 900, y: 270 }];
  assert.equal(pinchViewport(defaultViewport, near, far, bounds).k, MAX_MAP_ZOOM);
  assert.equal(pinchViewport(defaultViewport, far, near, bounds).k, 1);
  assert.deepEqual(pinchViewport(defaultViewport, [near[0], near[0]], far, bounds), defaultViewport);
});
