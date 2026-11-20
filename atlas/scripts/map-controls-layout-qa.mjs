import assert from "node:assert/strict";

export async function runMapControlsLayoutQA({ evaluate, cdp, click, input, waitFor, navigate, screenshot, fixtureOrigin }) {
  await navigate(fixtureOrigin);
  await waitFor("document.querySelector('.map-pin[data-draggable=true]') && document.querySelector('.reset-positions')");
  await click('.timeline-date .month-picker-trigger');
  assert.equal(await evaluate("document.querySelector('.timeline-date .month-picker-footer').children.length"),1,'Timeline always has a selected date');
  await input('.month-picker-year input','1886');
  await click('[data-month-option="1886-03"]');
  await waitFor("document.querySelector('.timeline-date .month-picker-trigger').dataset.monthValue==='1886-03'");
  assert.equal(await evaluate("Number(document.querySelector('.timeline-slider input').value)"),1886*12+2);
  await click('.timeline-play');
  await click('.timeline-date .month-picker-trigger');
  assert.equal(await evaluate("Boolean(document.querySelector('.timeline-speed'))"),false,'Opening date picker pauses playback');
  await click('.timeline-date .month-picker-footer button');
  const key=async key=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,...(key==='Enter'?{text:'\r'}:{})});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});};
  const selectRegion=async region=>{for(const value of ['Europe','Asia','Africa','North America','South America','Oceania']) {if(await evaluate(`document.querySelector('[data-region="${value}"]').getAttribute('aria-checked')`) !== String(value===region)) await click(`[data-region="${value}"]`);}};
  const positions=()=>evaluate("Object.keys(JSON.parse(localStorage.getItem('atlas-people-v1:fixture-a')).positions).length");
  const toggle=async(index,open)=>{
    await evaluate(`document.querySelectorAll('.layer-controls .control-section-title')[${index}].focus()`);await key('Enter');
    assert.equal(await evaluate(`document.querySelectorAll('.layer-controls .control-section-title')[${index}].getAttribute('aria-expanded')`),String(open));
    assert.equal(await evaluate(`document.getElementById(document.querySelectorAll('.layer-controls .control-section-title')[${index}].getAttribute('aria-controls')).hidden`),!open);
  };
  assert.equal(await evaluate("Boolean(document.querySelector('.map-subbar-title h2')) && !document.querySelector('.map-card-header')"),true);
  assert.equal(await evaluate("document.querySelector('.region-filter').closest('.layer-controls')!==null && !document.querySelector('.map-card .region-filter')"),true);
  assert.equal(await evaluate("document.querySelector('.reset-filters').nextElementSibling.classList.contains('reset-positions')"),true);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.reset-positions')).fontSize"),'11px');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.reset-filters')).fontSize"),'11px');
  assert.equal(await evaluate("document.querySelector('.reset-positions').disabled"),true);
  await evaluate("document.querySelector('.map-pin').focus({preventScroll:true})");await key('ArrowRight');await waitFor("!document.querySelector('.reset-positions').disabled");
  assert.ok(await positions()>0);
  assert.equal(await evaluate("[...document.querySelectorAll('.layer-controls .control-section-title')].every(button=>button.getAttribute('aria-expanded')==='false')"),true,'All map sections start collapsed');
  assert.equal(await evaluate("[...document.querySelectorAll('.layer-controls .control-section-content')].every(panel=>panel.hidden)"),true);
  for(const index of [0,1,2]) await toggle(index,true);
  assert.equal(await evaluate("document.querySelectorAll('.region-filter select,.region-filter option').length"),0);
  await selectRegion('Asia');
  await click('[data-region="Europe"]');
  assert.equal(await evaluate("document.querySelectorAll('.region-row[aria-checked=true]').length"),2);
  await click('[data-region="Asia"]');await click('[data-region="Europe"]');
  assert.equal(await evaluate("document.querySelectorAll('.region-row[aria-checked=true]').length"),0);
  assert.equal(await evaluate("document.querySelectorAll('.map-pin').length"),0,'No selected continents means no people');
  await selectRegion('Asia');await click('.role-row');await click('.layer-controls .toggle-row');
  await toggle(0,false);await toggle(0,true);
  assert.equal(await evaluate("[...document.querySelectorAll('.region-row[aria-checked=true]')].map(button=>button.dataset.region).join()"),'Asia');
  for(const index of [1,2]) {await toggle(index,false);await toggle(index,true);}
  assert.equal(await evaluate("document.querySelector('.role-row').getAttribute('aria-checked')"),'false');
  assert.equal(await evaluate("document.querySelector('.layer-controls .toggle-row').getAttribute('aria-checked')"),'true');
  await click('.reset-filters');
  assert.equal(await evaluate("document.querySelectorAll('.region-row[aria-checked=true]').length"),6);
  assert.equal(await evaluate("[...document.querySelectorAll('.layer-row')].every(button=>button.getAttribute('aria-checked')==='true')"),true);
  assert.equal(await evaluate("document.querySelector('.layer-controls .toggle-row').getAttribute('aria-checked')"),'false');
  assert.ok(await positions()>0,'Reset filters leaves portrait positions intact');
  await click('.reset-positions');await waitFor("document.querySelector('.reset-positions').disabled");assert.equal(await positions(),0);
  for(const locale of ['en','fa']) {
    if(await evaluate('document.documentElement.lang')!==locale) await click('[data-testid=language-switcher]');
    assert.equal(await evaluate('document.title'),locale==='fa'?'اطلس پیما':'Atlas Peyma','Page title follows the selected language');
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3')");
    for(const width of [1920,1440,1000,760,390,320]) {
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<=760});
      await evaluate("document.querySelector('.map-subbar').scrollIntoView({block:'center',behavior:'instant'})");
      assert.equal(await evaluate("(()=>{const b=document.querySelector('.map-subbar').getBoundingClientRect(),v=document.querySelector('.map-view-label').getBoundingClientRect();return Math.abs(b.x+b.width/2-v.x-v.width/2)<1.5})()"),true,`${locale}/${width} metadata is centered`);
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
      if(width<=760) assert.equal(await evaluate("(()=>{const rows=[...document.querySelector('.map-subbar').children].map(el=>{const r=el.getBoundingClientRect();return r.top+r.height/2});return Math.max(...rows)-Math.min(...rows)<2})()"),true,`${locale}/${width} mobile subbar stays on one horizontal row`);
      await click('.map-subbar .map-type-trigger');
      assert.equal(await evaluate("(()=>{const r=document.querySelector('.map-type-options').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth+1})()"),true);
      await key('Escape');
      await evaluate("document.querySelector('.timeline-date').scrollIntoView({block:'center',behavior:'instant'})");
      await click('.timeline-date .month-picker-trigger');
      assert.equal(await evaluate("(()=>{const p=document.querySelector('.timeline-date .month-picker-panel'),r=p.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth+1 && r.top>=0 && r.bottom<=innerHeight+1 && p.scrollWidth<=p.clientWidth+1})()"),true,`${locale}/${width} timeline picker fits viewport`);
      await key('Escape');
      if([1920,390].includes(width)) {
        await evaluate("document.querySelector('.map-subbar').scrollIntoView({block:'start',behavior:'instant'})");
        await screenshot(`map-controls-${locale}-${width}`);
      }
    }
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
  await evaluate("localStorage.setItem('atlas-map-tour-v1','done');document.querySelector('.map-experience').requestFullscreen=async()=>{throw new Error('QA fallback')}");
  await click('[data-tour=fullscreen]');await waitFor("document.querySelector('.map-expanded')");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.map-subbar')).display"),'none');
  assert.equal(await evaluate("Boolean(document.querySelector('.map-expanded .inspector .region-filter')) && Boolean(document.querySelector('.map-expanded .inspector .reset-positions'))"),true);
  await click('.timeline-date .month-picker-trigger');
  assert.equal(await evaluate("(()=>{const p=document.querySelector('.timeline-date .month-picker-panel'),r=p.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight+1 && p.checkVisibility()})()"),true,'Fullscreen timeline picker remains visible');
  await key('Escape');
  await toggle(0,false);await toggle(0,true);await screenshot('map-controls-fullscreen');await click('[data-tour=fullscreen]');

  await navigate(`${fixtureOrigin}?fixture=custom-accent`);await waitFor("document.querySelector('.atlas-app[data-ready=true]')");
  const sections=await evaluate("document.querySelectorAll('.appearance-controls .control-section-title').length");
  assert.equal(sections,4);
  assert.equal(await evaluate("[...document.querySelectorAll('.appearance-controls .control-section-title')].every(button=>button.getAttribute('aria-expanded')==='false')"),true,'All appearance sections start collapsed');
  for(let index=0;index<sections;index++) {
    assert.equal(await evaluate(`document.querySelectorAll('.appearance-controls .control-section-content')[${index}].hidden`),true);
    await evaluate(`document.querySelectorAll('.appearance-controls .control-section-title')[${index}].focus()`);await key('Enter');
    assert.equal(await evaluate(`document.querySelectorAll('.appearance-controls .control-section-content')[${index}].hidden`),false);
    await key('Enter');assert.equal(await evaluate(`document.querySelectorAll('.appearance-controls .control-section-content')[${index}].hidden`),true);
  }
  console.log('PASS: map title/subbar and centered metadata, region in map controls, separate 11px reset actions, saved portrait reset, keyboard collapsible sections preserving values, appearance sections, RTL/mobile and fullscreen.');
}
