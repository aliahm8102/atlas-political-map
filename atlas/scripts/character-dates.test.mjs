import test from "node:test";
import assert from "node:assert/strict";
import { characterDateFields, characterDateValue } from "../lib/character-dates.ts";
import { customPersonSchema, emptyBrowserPeople, readBrowserPeople, writeBrowserPeople } from "../lib/browser-people.ts";
import { characterPayload, managedCharacterSchema, personFromRow } from "../lib/administration.ts";
import { defaultSettings, visiblePeople } from "../lib/atlas.ts";
import { createTranslator } from "../lib/i18n/index.ts";

test("all calendar months round trip without floating-point month shifts; legacy whole years remain January", () => {
  for (const year of [1886, 1999, 2000, 2024, 2025]) for (let month = 0; month < 12; month++) {
    const encoded = characterDateValue(String(year), month);
    assert.deepEqual(characterDateFields(encoded), { year: String(year), month });
  }
  assert.deepEqual(characterDateFields(2024), { year: "2024", month: 0 });
  assert.deepEqual(characterDateFields(null), { year: "", month: 0 });
  assert.equal(characterDateValue("", 6), null);
  for (const [year, month] of [["2024.5",0],["oops",0],["2024",-1],["2024",12],["2024",1.5]]) assert.ok(Number.isNaN(characterDateValue(year,month)));
});

test("a term can begin and end in the same year, with an inclusive first month and exclusive final month", () => {
  const original = { id:"custom:aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",name:"Monthly explorer",title:"Test",role:"leader",lat:35,lng:51,countryCode:"364",country:"Iran",region:"Asia",imageUrl:"",startYear:characterDateValue("2025",2),endYear:characterDateValue("2025",5),dataset:"custom" };
  const person = customPersonSchema.parse(original);
  for (let month = 0; month < 12; month++) assert.equal(visiblePeople([person],{...defaultSettings,year:2025,month}).length, month >= 2 && month < 5 ? 1 : 0);
  assert.equal(customPersonSchema.safeParse({...person,endYear:characterDateValue("2025",2)}).success,false);
  assert.equal(customPersonSchema.safeParse({...person,endYear:characterDateValue("2025",1)}).success,false);
  const memory = new Map(), storage = {getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
  writeBrowserPeople(storage,"test",{...emptyBrowserPeople,people:[person]});
  assert.deepEqual(readBrowserPeople(storage,"test").people[0],person);
  const payload = characterPayload(managedCharacterSchema.parse(person));
  const row = personFromRow({...payload,id:"shared",dataset_id:"community",latitude:35,longitude:51},[{code:"364",name:"Iran",region:"Asia"}]);
  assert.equal(row.startYear,person.startYear);
  assert.equal(row.endYear,person.endYear);
  assert.match(createTranslator("en").periodLabel(person), /Mar 2025.*Jun 2025/);
  assert.match(createTranslator("fa").periodLabel(person), /مارس.*ژوئن/);
});
