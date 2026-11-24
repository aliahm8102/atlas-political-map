import test from "node:test";
import assert from "node:assert/strict";
import { readSheet } from "read-excel-file/node";
import { applyPersonalImport, importColumns, importRows, planCharacterImport } from "../lib/character-import.ts";
import { peopleExport } from "../lib/directory-export.ts";
import { xlsxExport } from "../lib/xlsx-export.ts";
import { createTranslator } from "../lib/i18n/index.ts";

const country = { code: "004", name: "Afghanistan", region: "Asia", lat: 33, lng: 65 };
const countries = [country];
const existing = {
  id: "custom:11111111-1111-4111-a111-111111111111", name: "Existing", title: "Office",
  nameFa: "نمونه", titleFa: "سمت", role: "leader", dataset: "custom",
  countryCode: country.code, country: country.name, region: country.region, lat: 34, lng: 66, imageUrl: "", startYear: 2020, endYear: null,
};

test("re-import XLSX preserves the ID and canonical fields across languages and updates the existing draft", async () => {
  const source = [{ ...existing, name: "Updated", startYear: 2020.3332, endYear: 2021 }];
  const table = peopleExport(source, { tags: {}, groups: [] }, createTranslator("fa"), "fa", true);
  assert.deepEqual(table.headers, importColumns);
  const sheet = await readSheet(Buffer.from(xlsxExport(table)), 1);
  const rows = importRows(sheet);
  const imported = applyPersonalImport([existing], rows, countries);
  assert.deepEqual(imported, source);
  assert.notEqual(peopleExport(source, { tags: {}, groups: [] }, createTranslator("fa"), "fa").headers[0], "id");
});

test("required errors and unauthorized or duplicate IDs reject a batch, while unusable optional cells do not", () => {
  const row = [null, "New", "Office", "member", 4, null, "", 100, "invalid", "bad date", null, "invalid image"];
  const rows = importRows([importColumns, row]);
  const plan = planCharacterImport(rows, [existing], countries, "personal");
  assert.deepEqual(plan.issues, []);
  assert.equal(plan.entries[0].character.countryCode, "004");
  assert.equal(plan.entries[0].character.lat, country.lat);
  assert.equal(plan.entries[0].character.startYear, null);
  const updated = applyPersonalImport([existing], [...rows, ...importRows([importColumns, [existing.id, "Updated", "Office", "leader", "004"]])], countries);
  assert.equal(updated.length, 2);
  assert.equal(updated[0].id, existing.id);
  assert.equal(updated[0].startYear, existing.startYear);
  assert.equal(updated[0].nameFa, existing.nameFa);
  assert.match(updated[1].id, /^custom:/);
  const invalid = importRows([importColumns, row, [existing.id, "Other user", "", "leader", "004"]]);
  assert.deepEqual(planCharacterImport(invalid, [], countries, "personal").issues, [{ row: 3, field: "id" }, { row: 3, field: "title" }]);
  assert.throws(() => applyPersonalImport([], invalid, countries));
  const updates = importRows([importColumns, [existing.id, "1", "Office", "leader", "004"], [existing.id, "2", "Office", "leader", "004"]]);
  assert.deepEqual(planCharacterImport(updates, [existing], countries, "personal").issues, [{ row: 3, field: "id" }]);
  assert.equal(importRows([["name", ...importColumns]]), null);
});
