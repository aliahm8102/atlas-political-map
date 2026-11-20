import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

export async function runDirectoryExportQA({ cdp, evaluate, waitFor, click, type, screenshot, navigate }) {
  const directory=await fs.mkdtemp(path.resolve('outputs/export-downloads-'));
  await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});
  const set = (selector,value) => evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const range=async(from,to,fa=false)=>{await set(`[aria-label="${fa?'تاریخ فهرست':'Directory date'}"]`,from);await set(`[aria-label="${fa?'تاریخ پایان فهرست':'Directory end date'}"]`,to);};
  const open=()=>evaluate("document.querySelectorAll('.sidebar nav')[0].querySelectorAll('button')[1].click()");
  async function download(format,fa=false) {
    await set(`[aria-label="${fa?'فرمت خروجی':'Export format'}"]`,format);
    const previous=new Set(await fs.readdir(directory));
    await click('[data-directory-export]');
    let file;
    for(let attempt=0;attempt<100;attempt++) {
      file=(await fs.readdir(directory)).find(name=>!previous.has(name)&&name.endsWith(`.${format}`));
      if(file) break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(file,`The browser completed a real ${format} download`);
    const bytes=await fs.readFile(path.join(directory,file));assert.ok(bytes.length>0);
    const script=format==='xlsx'?"import openpyxl,sys,json;w=openpyxl.load_workbook(sys.argv[1]);print(json.dumps(list(w.active.values),ensure_ascii=True))":"import csv,sys,json;print(json.dumps(list(csv.reader(open(sys.argv[1],encoding='utf-8-sig',newline=''),delimiter=sys.argv[2])),ensure_ascii=True))";
    return JSON.parse(execFileSync('python',['-c',script,path.join(directory,file),format==='txt'?'\t':','],{encoding:'utf8'}));
  }
  await open(); await waitFor("document.querySelector('#directory-tab-countries')");
  await click('#directory-tab-countries');await range('2025-01','2025-12');
  await type('.country-directory-search input','Germany');
  await waitFor("document.querySelectorAll('.country-card').length===1");
  for(const format of ['xlsx','csv','txt']) {
    const rows=await download(format);assert.equal(rows.length,2);assert.equal(rows[1][0],'Germany');assert.equal(rows[1][1],'Berlin');assert.equal(Number(rows[1][2]),357022);assert.equal(Number(rows[1][3]),83491249);
    assert.equal(rows[1][5],'2025-01');assert.equal(rows[1][6],'2025-12');
  }
  await range('2025-01','2026-01');
  await waitFor("!document.querySelector('.country-card .country-facts')");
  for(const format of ['xlsx','csv','txt']) {const rows=await download(format);assert.deepEqual(rows[0],['Country','Region','Start date','End date']);assert.deepEqual(rows[1],['Germany','Europe','2025-01','2026-01']);}
  await range('2024-01','2024-12');
  const missing=await download('xlsx');assert.deepEqual(missing[1].slice(1,4),['','','']);
  await range('2025-12','2025-01');
  assert.equal(await evaluate("document.querySelector('[data-directory-export]').disabled"),true);
  await range('1980-01','1995-12');await type('.country-directory-search input','Soviet Union');
  await waitFor("document.querySelector('.country-card[data-country-code=\"hist-ussr\"]')");
  assert.equal((await download('csv'))[1][0],'Soviet Union');

  // Create a personal record whose term falls outside today's map date.
  await navigate('/workspace/characters');
  await waitFor("location.pathname==='/workspace/characters' && document.querySelector('[name=character-name]') && document.querySelector('.character-form button[type=submit]:not(:disabled)')");
  if(await evaluate("document.documentElement.lang!=='en'")) await click('[data-testid=language-switcher]');
  for(const [name,value] of [['character-name','Export QA character'],['character-title','Export QA office'],['character-name-fa','شخصیت خروجی'],['character-title-fa','سمت خروجی'],['character-start','2024'],['character-end','2025']]) await set(`[name=${name}]`,value);
  await set('[name=character-start-month]','2');await set('[name=character-end-month]','5');
  await click('.character-form button[type=submit]');
  await waitFor("document.querySelector('.custom-character')");
  await open();await click('#directory-tab-people');await range('2024-03','2025-05');
  await type('.directory-organization input[type=search]','Export QA character');
  await waitFor("document.querySelectorAll('.person-card[data-person-id]').length===1");
  await type('#directory-group-name','Export group');await click('.group-form button[type=submit]');
  await waitFor("document.querySelector('[aria-label=\"Filter by group\"]').options.length>1");
  await click('.person-organization-actions button');await type('[name=person-tags]','Export tag');
  await click('.group-memberships input');await click('.modal-inner button[type=submit]');
  await waitFor("!document.querySelector('[name=person-tags]')");
  const group=await evaluate("[...document.querySelector('[aria-label=\"Filter by group\"]').options].find(option=>option.textContent.includes('Export group')).value");
  await set('[aria-label="Filter by group"]',group);await set('[aria-label="Filter by tag"]','Export tag');
  await click('[data-testid=language-switcher]');
  await waitFor("document.documentElement.lang==='fa'");
  for(const format of ['xlsx','csv','txt']) {
    const rows=await download(format,true);assert.equal(rows.length,2);assert.equal(rows[0][0],'نام شخصیت');assert.equal(rows[1][0],'شخصیت خروجی');assert.equal(rows[1][1],'سمت خروجی');assert.equal(rows[1][5],'2024-03');assert.equal(rows[1][6],'2025-06');assert.equal(rows[1][7],'Export tag');assert.equal(rows[1][8],'Export group');
  }
  await range('2025-06','2025-12',true);assert.equal(await evaluate("document.querySelector('[data-directory-export]').disabled"),true,'End-exclusive terms are excluded');
  await range('2024-03','2025-05',true);
  await click('.person-card-top .icon-button');
  await evaluate("document.querySelectorAll('.sidebar nav')[0].querySelectorAll('button')[2].click()");
  await waitFor("document.querySelector('[data-directory-export]') && document.querySelector('.person-card')");
  assert.equal((await download('csv',true))[1][0],'شخصیت خروجی');
  assert.ok((await fs.readdir(directory)).some(name=>name.startsWith('atlas-bookmarks-fa')));
  await open();await click('#directory-tab-people');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  await waitFor("(() => {const r=document.querySelector('.sidebar').getBoundingClientRect();return r.left>=innerWidth-1 || r.right<=1})()");
  for(const theme of ['light','dark','sand','midnight']) {
    await evaluate(`document.querySelector('.atlas-app').dataset.theme='${theme}';document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3');document.querySelector('.directory-date-range').scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-document.querySelector('.topbar').getBoundingClientRect().height-20,behavior:'instant'})`);
    await evaluate("(async()=>{const button=document.querySelector('.directory-month-input button');getComputedStyle(button).backgroundColor;await Promise.all(button.getAnimations().map(animation=>animation.finished.catch(()=>{})))})()");
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
    assert.equal(await evaluate(`(() => { const s=getComputedStyle(document.querySelector('.directory-month-input button')); const luminance=color=>{const [r,g,b]=color.match(/\\d+/g).slice(0,3).map(Number).map(value=>{const x=value/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};const a=luminance(s.color),b=luminance(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=3})()`),true,'Calendar icon keeps sufficient contrast in every theme');
    await screenshot(`export-date-${theme}-fa-mobile`);
  }
  console.log('PASS: actual XLSX/CSV/TXT downloads, independent readers, language/filter/tag/group matching, monthly ranges, missing data, multi-year omissions, historical identities, end-exclusive terms and themed mobile date controls.');
}
