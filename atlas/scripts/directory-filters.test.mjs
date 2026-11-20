import test from "node:test";
import assert from "node:assert/strict";
import { validDirectoryRange, personInRange, countryInRange } from "../lib/directory-filters.ts";

test("directory ranges validate month bounds, ordering and the supported timeline",()=>{
  for(const range of [{from:"1886-01",to:"2025-12"},{from:"2025-01",to:"2025-01"}]) assert.equal(validDirectoryRange(range),true);
  for(const range of [{from:"2025-12",to:"2025-01"},{from:"1885-12",to:"2025-01"},{from:"2025-00",to:"2025-12"},{from:"2025-01",to:"2025-13"},{from:"",to:"2025-12"},{from:"2025-1",to:"2025-12"},{from:"2025-01",to:"9999-12"}]) assert.equal(validDirectoryRange(range),false);
});
test("people range filtering includes any active month and keeps term ends exclusive",()=>{
  const term={startYear:2025+2/12,endYear:2025+5/12};
  for(const [range,expected] of [[{from:"2025-01",to:"2025-03"},true],[{from:"2025-06",to:"2025-08"},false],[{from:"2024-01",to:"2025-02"},false],[{from:"2025-05",to:"2026-01"},true],[{from:"2026-01",to:"2025-01"},false]]) assert.equal(personInRange(term,range),expected);
  assert.equal(personInRange({startYear:null,endYear:null},{from:"1886-01",to:"1886-01"}),true);
  assert.equal(personInRange({startYear:2025.02,endYear:2025.06},{from:"2025-01",to:"2025-12"}),false,'No active monthly sample for a term entirely between two timeline months');
});
test("country ranges include predecessor and successor identities only where their monthly lifetime overlaps",()=>{
  assert.equal(countryInRange("hist-ussr",{from:"1980-01",to:"1990-12"}),true);
  assert.equal(countryInRange("hist-ussr",{from:"2020-01",to:"2025-12"}),false);
  assert.equal(countryInRange("276",{from:"1980-01",to:"1989-12"}),false);
  assert.equal(countryInRange("276",{from:"1980-01",to:"2025-12"}),true);
  assert.equal(countryInRange("276",{from:"1990-10",to:"1990-10"}),false,'German reunification was after the October timeline sample');
  assert.equal(countryInRange("276",{from:"1990-10",to:"1990-11"}),true);
});
