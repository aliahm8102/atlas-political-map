import { feature } from "topojson-client";
import { geoArea, geoBounds, geoContains } from "d3-geo";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { z } from "zod";
import { isoDateSchema, periodContains, countryEntities } from "./country-entities.ts";
import type { Person } from "./atlas.ts";

const propertiesSchema = z.object({ countryId: z.string(), validFrom: isoDateSchema, validTo: isoDateSchema, versionId: z.string(), sourceFid: z.number().int(), status: z.string() }).refine(record => record.validFrom < record.validTo, "Invalid boundary interval");
export type HistoricalFeature = Feature<Polygon | MultiPolygon, z.infer<typeof propertiesSchema>>;
export function decodeHistoricalBorders(data: unknown): HistoricalFeature[] {
  const topology = data as { type?: string; objects?: { countries?: { type?: string; geometries?: unknown[] } }; arcs?: unknown[] };
  if (topology?.type !== "Topology" || topology.objects?.countries?.type !== "GeometryCollection" || !Array.isArray(topology.objects.countries.geometries) || !Array.isArray(topology.arcs)) throw new Error("Invalid historical boundary file");
  const decoded = feature(data as never, topology.objects.countries as never) as unknown as { features: HistoricalFeature[] };
  return decoded.features.map(value => {
    const properties = propertiesSchema.parse(value.properties);
    if (!countryEntities[properties.countryId] || !["Polygon", "MultiPolygon"].includes(value.geometry?.type)) throw new Error("Unknown historical country or unsupported geometry");
    return { ...value, id: properties.countryId, properties };
  });
}
export function bordersAtDate(features: HistoricalFeature[], date: string) {
  return features.filter(item => periodContains(item.properties, date));
}
const bounds = new WeakMap<HistoricalFeature, ReturnType<typeof geoBounds>>();
const areas = new WeakMap<HistoricalFeature, number>();
export function peopleAtHistoricalBorders(people: Person[], features: HistoricalFeature[]): Person[] {
  const ordered = [...features].sort((a, b) => {
    if (!areas.has(a)) areas.set(a, geoArea(a));
    if (!areas.has(b)) areas.set(b, geoArea(b));
    return areas.get(a)! - areas.get(b)!;
  });
  return people.map(person => {
    const country = ordered.find(item => {
      if (!bounds.has(item)) bounds.set(item, geoBounds(item));
      const [[west, south], [east, north]] = bounds.get(item)!;
      return person.lat >= south && person.lat <= north && (west <= east ? person.lng >= west && person.lng <= east : person.lng >= west || person.lng <= east) && geoContains(item, [person.lng, person.lat]);
    });
    const entity = country && countryEntities[country.properties.countryId];
    return entity ? { ...person, countryCode: entity.code, country: entity.nameEn } : person;
  });
}
