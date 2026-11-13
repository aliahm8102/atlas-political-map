import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { feature } from "topojson-client";
import { geoContains } from "d3-geo";

test("the documented custom GeoJSON import replaces only its time window and preserves edited annual records", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-historical-import-"));
  assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir(), "atlas-historical-import-")));
  try {
    for (const directory of ["data/source", "data/historical-boundaries", "data/country-history"]) await fs.mkdir(path.join(temporary, directory), { recursive: true });
    for (const filename of ["data/country-profiles.json", "data/source/cshapes-2.0-gw.topojson.xz", "data/historical-boundaries/overrides.json"]) await fs.copyFile(path.join(root, filename), path.join(temporary, filename));
    const entity = JSON.parse(await fs.readFile(path.join(root, "data/historical-boundaries/template.entity.json"), "utf8"));
    entity["hist-example"].dissolvedOn = "1952-01-01";
    const border = JSON.parse(await fs.readFile(path.join(root, "data/historical-boundaries/template.border.geojson"), "utf8"));
    Object.assign(border.features[0].properties, { validFrom: "1950-01-01", validTo: "1951-01-01", replaces: ["hist-czechoslovakia"] });
    await fs.writeFile(path.join(temporary, "data/historical-boundaries/custom-entities.json"), JSON.stringify(entity));
    await fs.writeFile(path.join(temporary, "data/historical-boundaries/custom-borders.geojson"), JSON.stringify(border));
    const annual = path.join(temporary, "data/country-history/276.json");
    const edited = '{"code":"276","years":{"2025":{"capitalFa":null,"capitalEn":"Edited capital","areaKm2":1,"population":123,"flagPath":null}}}\n';
    await fs.writeFile(annual, edited);
    execFileSync(process.execPath, [path.join(root, "scripts/import-historical-boundaries.mjs")], { cwd: temporary, windowsHide: true, stdio: "pipe" });
    assert.equal(await fs.readFile(annual, "utf8"), edited);
    const topology = JSON.parse(await fs.readFile(path.join(temporary, "public/boundaries/cshapes-2.0.topojson"), "utf8"));
    const decoded = feature(topology, topology.objects.countries).features;
    const active = date => decoded.filter(value => value.properties.validFrom <= date && date < value.properties.validTo);
    assert.ok(active("1949-01-01").some(value => value.properties.countryId === "hist-czechoslovakia"));
    assert.ok(active("1951-01-01").some(value => value.properties.countryId === "hist-czechoslovakia"));
    assert.equal(active("1950-06-01").some(value => value.properties.countryId === "hist-czechoslovakia"), false);
    const added = active("1950-06-01").find(value => value.properties.countryId === "hist-example");
    assert.ok(added);
    assert.equal(geoContains(added, [15, 50]), true, "Standard GeoJSON winding is normalized for D3");
    const catalog = JSON.parse(await fs.readFile(path.join(temporary, "data/historical-boundaries/catalog.json"), "utf8"));
    assert.equal(catalog.entities["hist-example"].nameFa, entity["hist-example"].nameFa);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(temporary, "data/country-history/hist-example.json"), "utf8")).years, {});
  } finally {
    assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir(), "atlas-historical-import-")));
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
