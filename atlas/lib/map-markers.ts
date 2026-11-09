import type { Person } from "./atlas.ts";
import type { MarkerPosition } from "./browser-people.ts";

export type PersonCluster = { person: Person; x: number; y: number; people: Person[] };

export function clusterMapPeople(people: Person[], options: {
  project: (coordinates: [number, number]) => [number, number] | null;
  positions: Partial<Record<string, MarkerPosition>>;
  moving: { id: string; position: MarkerPosition } | null;
  zoom: number; scale: number; highlighted: string[]; selectedId?: string | null;
}): PersonCluster[] {
  const { project, positions, moving, zoom, scale, highlighted, selectedId } = options;
  const grouped: PersonCluster[] = [];
  const ordered = [...people].sort((a, b) => Number(highlighted.includes(a.id)) - Number(highlighted.includes(b.id)) || Number(b.role === "leader") - Number(a.role === "leader"));
  for (const person of ordered) {
    const geographic = project([person.lng, person.lat]);
    if (!geographic) continue;
    const override = moving?.id === person.id ? moving.position : positions[person.id];
    const point = override ? [override.x, override.y] : geographic;
    const near = !highlighted.includes(person.id) && person.dataset !== "custom" && !override && grouped.find(group => !highlighted.includes(group.person.id) && group.person.dataset !== "custom" && !positions[group.person.id] && moving?.id !== group.person.id && Math.hypot(group.x - point[0], group.y - point[1]) * zoom * scale < (scale < .5 ? 33 : 41));
    if (near) near.people.push(person);
    else grouped.push({ person, x: point[0], y: point[1], people: [person] });
  }
  // Keep cluster anchors while replacing the representative with the selected
  // portrait. SVG paints later siblings on top of all other portraits.
  return grouped.map(group => ({ ...group, person: group.people.find(person => person.id === selectedId) ?? group.person }))
    .sort((a, b) => Number(a.person.id === selectedId) - Number(b.person.id === selectedId));
}
