import test from "node:test";
import assert from "node:assert/strict";
import { geoNaturalEarth1 } from "d3-geo";
import { EARTH_RADIUS_KM, measurementCoordinate, measureRoute } from "../lib/map-measurement.ts";

test("ruler sums surface distances between successive points rather than screen lengths or endpoint distance", () => {
  assert.deepEqual(measureRoute([]), { segments: [], total: 0 });
  assert.deepEqual(measureRoute([[0, 0]]), { segments: [], total: 0 });
  const route = measureRoute([[0, 0], [90, 0], [0, 0]]);
  assert.equal(route.segments.length, 2);
  assert.ok(Math.abs(route.total - Math.PI * EARTH_RADIUS_KM) < .00001);
  const tehranLondon = measureRoute([[51.389, 35.6892], [-.1276, 51.5072]]).total;
  assert.ok(tehranLondon > 4390 && tehranLondon < 4420, `Tehran–London: ${tehranLondon}`);
});

test("dateline crossing follows the short arc and polar or repeated points remain finite", () => {
  const crossing = measureRoute([[179, 0], [-179, 0]]).total;
  assert.ok(crossing > 222 && crossing < 223);
  assert.equal(measureRoute([[10, 20], [10, 20]]).total, 0);
  assert.ok(measureRoute([[0, 89], [180, 89]]).total < 223);
  assert.ok(Math.abs(measureRoute([[0, 0], [180, 0]]).total - Math.PI * EARTH_RADIUS_KM) < .00001);
});

test("map projection round trips geographic points and rejects empty area outside the world", () => {
  const projection = geoNaturalEarth1().scale(170).translate([500, 270]);
  for (const coordinate of [[0, 0], [51.389, 35.6892], [-179, 70], [170, -60]]) {
    const [x, y] = projection(coordinate);
    const actual = measurementCoordinate({ x, y }, projection);
    assert.ok(actual);
    assert.ok(Math.hypot(actual[0] - coordinate[0], actual[1] - coordinate[1]) < .00001);
  }
  assert.equal(measurementCoordinate({ x: -1000, y: 270 }, projection), null);
  assert.equal(measurementCoordinate({ x: 500, y: -500 }, projection), null);
  assert.equal(measurementCoordinate({ x: NaN, y: 0 }, projection), null);
});
