import test from "node:test";
import assert from "node:assert/strict";
import { geoMercator } from "d3-geo";
import { geographicExtent, geographicMaxZoom, leafletCamera, rasterLayers } from "../lib/map-layers.ts";
import { constrainViewport, defaultViewport, zoomViewport } from "../lib/atlas.ts";
import { mapGeometry, pinchViewport } from "../lib/map-gestures.ts";

test("Leaflet and the portrait/drawing overlay stay aligned at different locations, zooms and aspect ratios", () => {
  const projection = geoMercator().scale(1000 / (2 * Math.PI)).translate([500, 270]);
  for (const coordinate of [[0, 0], [13.4, 52.5], [-74, 40.7], [139.7, 35.7], [19, 78]]) {
    for (const k of [1, 2.7, 1000, 40000]) {
      const [x, y] = projection(coordinate);
      for (const [width, height, cover] of [[900, 400, false], [320, 640, true], [844, 390, true]]) {
        const { scale } = mapGeometry(width, height, cover);
        const camera = leafletCamera({ k, x: 500 - x * k, y: 270 - y * k }, scale);
        assert.ok(Math.abs(camera.center[0] - coordinate[1]) < 1e-8);
        assert.ok(Math.abs(camera.center[1] - coordinate[0]) < 1e-8);
        assert.ok(Math.abs(256 * 2 ** camera.zoom - 1000 * k * scale) < 1e-6);
      }
    }
  }
});

test("raster zoom controls and pinches respect each provider's native coverage without changing the default map", () => {
  const { scale, bounds } = mapGeometry(390, 844, true);
  for (const type of Object.keys(rasterLayers)) {
    const max = geographicMaxZoom(type, scale);
    const view = zoomViewport(defaultViewport, 1e10, undefined, bounds, max, geographicExtent);
    assert.equal(view.k, max);
    assert.ok(Math.abs(leafletCamera(view, scale).zoom - rasterLayers[type].maxZoom) < 1e-8);
    assert.equal(pinchViewport(defaultViewport, [{ x: 499, y: 270 }, { x: 501, y: 270 }], [{ x: -1e8, y: 270 }, { x: 1e8, y: 270 }], bounds, max, geographicExtent).k, max);
  }
  assert.equal(zoomViewport(defaultViewport, 1e10).k, 64);
});

test("Mercator panning can reach polar regions while keeping a finite world extent", () => {
  const k = 10;
  const north = constrainViewport({ k, x: 0, y: 1e8 }, undefined, 100, geographicExtent);
  const south = constrainViewport({ k, x: 0, y: -1e8 }, undefined, 100, geographicExtent);
  assert.ok(leafletCamera(north, 1).center[0] > 80);
  assert.ok(leafletCamera(south, 1).center[0] < -80);
  assert.ok([north.x, north.y, south.x, south.y].every(Number.isFinite));
});
