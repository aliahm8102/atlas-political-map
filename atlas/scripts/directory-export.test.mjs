import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { peopleExport, countriesExport, delimitedExport, exportFile } from "../lib/directory-export.ts";
import { xlsxExport } from "../lib/xlsx-export.ts";
import { createTranslator } from "../lib/i18n/index.ts";
import { countryProfile } from "../lib/country-profiles.ts";

const en = createTranslator("en"), fa = createTranslator("fa");
const person = { id:"a", name:'Name, "quoted"\nsecond line',nameFa:"شخصیت فارسی",title:"=1+1",titleFa:"سمت فارسی",role:"leader",country:"Iran",countryCode:"364",region:"Asia",lat:35.7,lng:-51.4,startYear:2025+2/12,endYear:null,imageUrl:"",dataset:"custom" };
const organization = { tags:{a:["tag, one","=unsafe"]},groups:[{id:"g",name:"My group",personIds:["a"]}] };

test("people exports preserve localized fields, monthly dates, tags/groups, numeric coordinates and optional dates",()=>{
  const table=peopleExport([person],organization,en,"en");
  assert.equal(table.rows.length,1);
  assert.deepEqual(table.rows[0],[person.name,person.title,"Heads of state","Iran","Asia","2025-03",null,"tag, one, =unsafe","My group",35.7,-51.4]);
  const persian=peopleExport([person],organization,fa,"fa");
  assert.equal(persian.rtl,true);assert.equal(persian.rows[0][0],person.nameFa);assert.equal(persian.rows[0][1],person.titleFa);
  assert.equal(persian.headers[0],"نام شخصیت");
});

test("country exports retain annual numeric facts and blank missing-year data without substituting a modern year",()=>{
  const country={code:"276",name:"Germany",region:"Europe",lat:52.5,lng:13.4};
  const table=countriesExport([countryProfile(country,2025)],2025,0,en,"en");
  assert.deepEqual(table.rows[0].slice(0,6),["Germany","Berlin",357022,83491249,"Europe","2025-01"]);
  const missing=countriesExport([countryProfile(country,2024)],2024,5,fa,"fa");
  assert.deepEqual(missing.rows[0].slice(0,6),["آلمان",null,null,null,"اروپا","2024-06"]);
  assert.equal(missing.rows[0][7],null);
});

test("multi-year country exports omit all year-specific facts and preserve the requested range",()=>{
  const country={code:"276",name:"Germany",region:"Europe",lat:52.5,lng:13.4};
  const table=countriesExport([countryProfile(country,2025)],2025,11,en,"en",2026,0);
  assert.deepEqual(table.headers,["Country","Region","Start date","End date"]);
  assert.deepEqual(table.rows,[["Germany","Europe","2025-12","2026-01"]]);
  const sameYear=countriesExport([countryProfile(country,2025)],2025,0,en,"en",2025,11);
  assert.equal(sameYear.rows[0][2],357022);assert.equal(sameYear.rows[0][6],"2025-12");
  const missing=peopleExport([{...person,name:"Untranslated QA name",nameFa:"",title:"Untranslated QA office",titleFa:""}],organization,fa,"fa");
  assert.deepEqual(missing.rows[0].slice(0,2),[null,null]);
});

test("CSV and TXT handle Unicode, quotes, delimiters, newlines, nulls and spreadsheet formula injection",()=>{
  for (const separator of [",","\t"]) {
    const table={title:"Export",headers:["Name","Value"],rtl:false,rows:[["فارسی,\t\"quoted\"\nline",null],["=1+1",-12],[" \t@SUM(1)","+cmd"],["\tstart","-text"]]};
    const output=delimitedExport(table,separator);
    assert.ok(output.startsWith("\uFEFF"));
    const parsed=JSON.parse(execFileSync("python",["-c","import csv,io,json,sys; print(json.dumps(list(csv.reader(io.StringIO(sys.stdin.buffer.read().decode('utf-8-sig')), delimiter=sys.argv[1])),ensure_ascii=True))",separator],{input:output,encoding:"utf8"}));
    assert.deepEqual(parsed,[table.headers,[table.rows[0][0],""],["'=1+1","-12"],["' \t@SUM(1)","'+cmd"],["'\tstart","'-text"]]);
  }
});

test("XLSX ZIP/XML parts keep numbers numeric and formula-like text literal",()=>{
  const table={title:"فهرست کشورها",headers:["نام","عدد","خالی","متن"],rtl:true,rows:[["فارسی <&> \"'\u0001",1234.5,null,"=HYPERLINK(\"bad\")"],["line\nnext",-12,0,"@SUM(1)"]]};
  const bytes=xlsxExport(table);
  const result=JSON.parse(execFileSync("python",["-c",`import io,json,sys,zipfile,xml.etree.ElementTree as E
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
 assert z.testzip() is None
 for name in z.namelist(): E.fromstring(z.read(name))
 w=E.fromstring(z.read('xl/workbook.xml'));s=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
 assert s.find('.//s:f',ns) is None
 rows=s.findall('s:sheetData/s:row',ns)
 def value(c):
  return float(c.find('s:v',ns).text) if c.get('t')=='n' else c.find('s:is/s:t',ns).text or ''
 print(json.dumps({'title':w.find('s:sheets/s:sheet',ns).get('name'),'rows':[[value(c) for c in r] for r in rows],'types':['n' if c.get('t')=='n' else 's' for c in rows[1]],'rtl':s.find('s:sheetViews/s:sheetView',ns).get('rightToLeft')=='1','freeze':s.find('.//s:pane',ns).get('topLeftCell'),'filter':s.find('s:autoFilter',ns).get('ref')},ensure_ascii=True))`],{input:bytes,encoding:"utf8"}));
  assert.equal(result.title,table.title);assert.deepEqual(result.rows[0],table.headers);
  assert.deepEqual(result.rows[1],["فارسی <&> \"'",1234.5,"","=HYPERLINK(\"bad\")"]);
  assert.deepEqual(result.types,["s","n","s","s"]);assert.equal(result.rtl,true);assert.equal(result.freeze,"A2");assert.equal(result.filter,"A1:D3");
});

test("all download formats have the correct MIME type and nonempty data, including empty-list headers",async()=>{
  const table={title:"People",headers:["Name"],rows:[],rtl:false};
  for(const format of ["xlsx","csv","txt"]) {
    const blob=await exportFile(table,format);assert.ok(blob.size>0);
    assert.match(blob.type,format==="xlsx"?/spreadsheetml/:format==="csv"?/text\/csv/:/text\/plain/);
    if(format!=="xlsx") assert.equal(await blob.text(),"Name\r\n"); // Blob.text removes the UTF-8 BOM.
  }
});
