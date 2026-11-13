export type MapTarget = { kind: "person" | "country"; id: string };
export const mapTargetId = (target: MapTarget) => `${target.kind}-${encodeURIComponent(target.id)}`;
export function mapResultHref(result: { person?: { id: string }; country?: { code: string } }) {
  const target: MapTarget | null = result.person ? { kind: "person", id: result.person.id } : result.country ? { kind: "country", id: result.country.code } : null;
  return `/workspace#${target ? mapTargetId(target) : "atlas-map"}`;
}
export function parseMapTarget(hash: string): MapTarget | null {
  const match = /^#(person|country)-(.+)$/.exec(hash);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[2]);
    return id.length <= 160 && /^[a-zA-Z0-9:_-]+$/.test(id) ? { kind: match[1] as MapTarget["kind"], id } : null;
  } catch { return null; }
}
