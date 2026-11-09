import test from "node:test";
import assert from "node:assert/strict";
import { clusterMapPeople } from "../lib/map-markers.ts";

const leader = { id: "leader", name: "First portrait", role: "leader", lat: 0, lng: 0, imageUrl: "first.jpg", dataset: "imported" };
const selected = { ...leader, id: "selected", name: "Selected portrait", role: "army", lng: 1, imageUrl: "selected.jpg" };
const other = { ...leader, id: "other", lng: 200 };
const options = { project: ([lng, lat]) => [lng, lat], positions: {}, moving: null, zoom: 1, scale: 1, highlighted: [] };

test("a selected member replaces the initial cluster portrait and paints last", () => {
  const initial = clusterMapPeople([leader, selected, other], options);
  assert.equal(initial[0].person.id, leader.id);
  const changed = clusterMapPeople([leader, selected, other], { ...options, selectedId: selected.id });
  assert.equal(changed.length, 2);
  assert.equal(changed.at(-1).person.imageUrl, "selected.jpg");
  assert.equal(changed.at(-1).x, initial[0].x);
  assert.deepEqual(changed.at(-1).people.map(person => person.id), [leader.id, selected.id]);
  assert.equal(clusterMapPeople([leader, selected, other], options)[0].person.id, leader.id);
});

test("selected independent or highlighted markers stay above overlapping portraits", () => {
  for (const overrides of [{ highlighted: [selected.id] }, { positions: { selected: { x: 0, y: 0 } } }, { moving: { id: selected.id, position: { x: 0, y: 0 } } }]) {
    const result = clusterMapPeople([leader, selected], { ...options, ...overrides, selectedId: selected.id });
    assert.equal(result.length, 2); assert.equal(result.at(-1).person.id, selected.id);
  }
});

test("selection does not bypass date/role filtering or mutate the source collection", () => {
  const input = [leader, other];
  const result = clusterMapPeople(input, { ...options, selectedId: selected.id });
  assert.equal(result.some(group => group.person.id === selected.id), false);
  assert.deepEqual(input, [leader, other]);
});
