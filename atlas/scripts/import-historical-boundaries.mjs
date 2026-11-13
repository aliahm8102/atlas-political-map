import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createHash } from "node:crypto";
import { feature, quantize } from "topojson-client";
import { geoArea, geoCentroid } from "d3-geo";
import { writeCountryHistoryIndex } from "./index-country-histories.mjs";

// The checked-in CRAN source is pinned and verified; normal builds need no download/Python.
const read = async file => JSON.parse(await fs.readFile(file, "utf8"));
const original = await fs.readFile("data/source/cshapes-2.0-gw.topojson.xz");
const sourceSha256 = createHash("sha256").update(original).digest("hex");
if (sourceSha256 !== "196c6d9d881cf944e176e4ce5bfc61074d21792de7152cb0a9e035e56b0297c8") throw new Error("CShapes source checksum mismatch");
const source = JSON.parse(execFileSync(process.env.PYTHON || "python", ["-c", "import sys,lzma;sys.stdout.buffer.write(lzma.decompress(sys.stdin.buffer.read()))"], { input: original, maxBuffer: 32 * 1024 * 1024 }).toString());
const base = await read("data/country-profiles.json"), overrides = await read("data/historical-boundaries/overrides.json");
const normalize = text => text.toLowerCase().replace(/[^a-z]/g, "");
const byName = new Map(Object.values(base).flatMap(country => [country.name, country.nameEn].map(name => [normalize(name), country.code])));
const crosswalk = { ...overrides.crosswalk };
const geometries = source.objects.cshapes_2_gw.geometries;
for (const { properties: p } of geometries) crosswalk[p.gwcode] ??= byName.get(normalize(p.country_name)) ?? byName.get(normalize(p.country_name.split(" (")[0]));
const statusFa = { colony: "مستعمره", protectorate: "تحت‌الحمایه", occupied: "اشغال‌شده", mandate: "قیمومت" };
const nextDay = date => new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const region = code => {
  if (code > 1000) code = Math.floor(code / 10);
  return code < 100 ? "North America" : code < 200 ? "South America" : code < 400 ? "Europe" : code < 630 ? "Africa" : code < 900 ? "Asia" : "Oceania";
};
const entities = {};
let versions = [];
for (const geometry of geometries) {
  const p = geometry.properties, independent = ["independent", "N/A"].includes(p.status);
  const modernId = crosswalk[p.gwcode];
  const pieces = independent && overrides.splits[p.gwcode] || [{ id: independent ? modernId ?? `hist-gw-${p.gwcode}` : `hist-${modernId ?? `gw-${p.gwcode}`}-${p.status}-${String(p.owner).replace(/[^a-z0-9-]/g, "-")}`, from: null, to: null }];
  for (const piece of pieces) {
    const from = [p.start, piece.from, piece.foundedOn].filter(Boolean).sort().at(-1), to = [nextDay(p.end), piece.to, piece.dissolvedOn].filter(Boolean).sort()[0];
    if (from >= to) continue;
    const current = base[piece.id];
    const nameEn = piece.nameEn ?? current?.nameEn ?? `${p.country_name}${independent ? "" : ` (${p.status})`}`;
    const faBase = base[modernId]?.nameFa ?? overrides.namesFa[p.gwcode];
    const nameFa = piece.nameFa ?? current?.nameFa ?? (faBase && `${faBase}${independent ? "" : ` (${statusFa[p.status] ?? p.status})`}`);
    if (!nameFa || !/[\u0600-\u06ff]/.test(nameFa)) throw new Error(`Missing Persian country name: ${p.gwcode} ${p.country_name}`);
    const center = geoCentroid(feature(source, geometry));
    const entity = entities[piece.id] ??= {
      code: piece.id, name: nameEn, nameEn, nameFa,
      region: current?.region ?? region(p.gwcode), lat: current?.lat ?? (Number.isFinite(p.caplat) ? p.caplat : center[1]), lng: current?.lng ?? (Number.isFinite(p.caplong) ? p.caplong : center[0]),
      source: "cshapes-2.0", modern: !piece.id.startsWith("hist-"),
      foundedOn: piece.foundedOn ?? null, dissolvedOn: piece.dissolvedOn ?? null,
      periods: [],
    };
    entity.periods.push({ validFrom: from, validTo: entity.modern && to === "2020-01-01" ? null : to });
    versions.push({ ...geometry, id: `${p.fid}-${from}`, properties: { countryId: piece.id, validFrom: from, validTo: to, versionId: `${p.fid}-${from}`, sourceFid: p.fid, status: p.status } });
  }
}
for (const country of Object.values(base)) entities[country.code] ??= { ...country, modern: true, foundedOn: null, dissolvedOn: null, periods: [{ validFrom: null, validTo: null }] };
const customEntities = await read("data/historical-boundaries/custom-entities.json");
const custom = await read("data/historical-boundaries/custom-borders.geojson");
for (const [code, entity] of Object.entries(customEntities)) {
  if (code !== entity.code || !/^[a-z0-9-]+$/.test(code)) throw new Error(`Invalid custom country identity: ${code}`);
  entities[code] = { name: entity.nameEn, source: "custom", modern: false, foundedOn: null, dissolvedOn: null, periods: [], ...entities[code], ...entity };
}
if (custom.type !== "FeatureCollection" || !Array.isArray(custom.features)) throw new Error("Custom borders must be a GeoJSON FeatureCollection");
const customIds = new Set();
const isDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
for (const value of custom.features) {
  const p = value.properties, entity = entities[p?.countryId];
  if (!entity || !isDate(p.validFrom) || !isDate(p.validTo) || p.validFrom >= p.validTo || p.validFrom < "1886-01-01" || p.validTo > "2020-01-01" || !p.versionId || customIds.has(p.versionId)) throw new Error("Invalid custom border dates, versionId or countryId");
  if (entity.foundedOn && p.validFrom < entity.foundedOn || entity.dissolvedOn && p.validTo > entity.dissolvedOn) throw new Error("Custom border period must lie within the country identity's lifetime");
  if (p.replaces !== undefined && (!Array.isArray(p.replaces) || p.replaces.some(code => typeof code !== "string" || !entities[code]))) throw new Error("Custom replaces entries must name existing country identities");
  customIds.add(p.versionId);
  const replaced = new Set([p.countryId, ...(p.replaces ?? [])]);
  // Replace only the intersecting time window; retain earlier/later border versions.
  versions = versions.flatMap(geometry => {
    const old = geometry.properties;
    if (!replaced.has(old.countryId) || old.validTo <= p.validFrom || old.validFrom >= p.validTo) return [geometry];
    const remaining = [];
    if (old.validFrom < p.validFrom) remaining.push({ ...geometry, properties: { ...old, validTo: p.validFrom, versionId: `${old.versionId}-before-${p.versionId}` } });
    if (old.validTo > p.validTo) remaining.push({ ...geometry, properties: { ...old, validFrom: p.validTo, versionId: `${old.versionId}-after-${p.versionId}` } });
    return remaining;
  });
  const geometry = value.geometry;
  if (!["Polygon", "MultiPolygon"].includes(geometry?.type)) throw new Error("Custom borders require Polygon or MultiPolygon geometry");
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const arcs = polygons.map(polygon => {
    if (!polygon.length) throw new Error("Custom polygon must contain a closed outer ring");
    const rings = polygon.map(ring => {
      if (ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1)) || ring.some(point => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90)) throw new Error("Custom rings need closed [longitude, latitude] positions");
      return ring;
    });
    const reversed = geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI;
    return rings.map(ring => { const index = source.arcs.length; source.arcs.push(reversed ? [...ring].reverse() : ring); return [index]; });
  });
  versions.push({ type: geometry.type, arcs: geometry.type === "Polygon" ? arcs[0] : arcs, properties: { countryId: p.countryId, validFrom: p.validFrom, validTo: p.validTo, versionId: `custom-${p.versionId}`, sourceFid: 0, status: "custom" } });
  entity.periods.push({ validFrom: p.validFrom, validTo: p.validTo });
}
for (const entity of Object.values(entities)) {
  if (!entity.periods.length) throw new Error(`No border period defined for custom identity ${entity.code}`);
  const periods = entity.periods.sort((a, b) => (a.validFrom ?? "").localeCompare(b.validFrom ?? ""));
  entity.periods = [];
  for (const period of periods) {
    const last = entity.periods.at(-1);
    if (last && (last.validTo === null || last.validTo >= period.validFrom)) last.validTo = last.validTo === null || period.validTo === null ? null : [last.validTo, period.validTo].sort().at(-1);
    else entity.periods.push({ ...period });
  }
  if (!base[entity.code]) {
    try { await fs.writeFile(`data/country-history/${entity.code}.json`, JSON.stringify({ $schema: "./schema.json", code: entity.code, years: {} }, null, 2) + "\n", { flag: "wx" }); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
  }
}
const topology = quantize({ ...source, objects: { countries: { type: "GeometryCollection", geometries: versions } } }, 100000);
await fs.mkdir("public/boundaries", { recursive: true });
const result = JSON.stringify(topology);
await fs.writeFile("public/boundaries/cshapes-2.0.topojson", result);
await fs.writeFile("data/historical-boundaries/catalog.json", JSON.stringify({ coverage: { validFrom: "1886-01-01", validTo: "2020-01-01" }, entities: Object.fromEntries(Object.entries(entities).sort()) }, null, 2) + "\n");
await fs.writeFile("data/historical-boundaries/provenance.json", JSON.stringify({ source: "https://raw.githubusercontent.com/cran/cshapes/54840534d9a82cfd01caf1021f85933e701e8318/inst/extdata/cshapes_2_gw.topojson.xz", sourceSha256, outputSha256: createHash("sha256").update(result).digest("hex"), project: "https://icr.ethz.ch/data/cshapes/", license: "CC-BY-NC-SA-4.0", licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/", citation: "Schvitz, Rüegger, Girardin, Cederman, Weidmann and Gleditsch (2022), Mapping The International System, 1886–2017: The CShapes 2.0 Dataset. Journal of Conflict Resolution 66(1):144–161.", modifications: "Quantized to 100,000 positions. Inclusive source end dates converted to exclusive ends. Source country-periods split into separate identities using overrides.json; coordinates are unchanged except quantization. Life dates and source-coverage dates are distinct. Modern Natural Earth fallback begins 2020-01-01; later border changes are not reconstructed.", versions: versions.length, entities: Object.keys(entities).length }, null, 2) + "\n");
await writeCountryHistoryIndex(path.resolve("data/country-history"));
console.log(`Imported ${versions.length} boundary versions and ${Object.keys(entities).length} identities (${result.length} bytes); preserved existing annual files.`);
