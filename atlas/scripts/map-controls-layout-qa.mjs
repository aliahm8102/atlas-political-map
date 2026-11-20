import assert from "node:assert/strict";

export async function runMapControlsLayoutQA({ evaluate, cdp, click, waitFor, navigate, screenshot, fixtureOrigin }) {
  await navigate(fixtureOrigin);
  await waitFor("document.querySelector('.map-pin[data-draggable=true]') && document.querySelector('.reset-positions')");
  const key=async key=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,...(key==='Enter'?{text:'\r'}:{})});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});};
  const selectRegion=value=>evaluate(`(()=>{const el=document.querySelector('.region-filter select');el.value='${value}';el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
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
  assert.equal(await evaluate("document.querySelectorAll('.layer-controls .control-section-title')[1].getAttribute('aria-expanded')"),'false');
  assert.equal(await evaluate("document.querySelectorAll('.layer-controls .control-section-content')[1].hidden"),true);
  await toggle(1,true);
  await selectRegion('Asia');await click('.layer-row');await click('.layer-controls .toggle-row');
  await toggle(0,false);await toggle(0,true);
  assert.equal(await evaluate("document.querySelector('.region-filter select').value"),'Asia');
  for(const index of [1,2]) {await toggle(index,false);await toggle(index,true);}
  assert.equal(await evaluate("document.querySelector('.layer-row').getAttribute('aria-checked')"),'false');
  assert.equal(await evaluate("document.querySelector('.layer-controls .toggle-row').getAttribute('aria-checked')"),'true');
  await click('.reset-filters');
  assert.equal(await evaluate("document.querySelector('.region-filter select').value"),'All regions');
  assert.equal(await evaluate("[...document.querySelectorAll('.layer-row')].every(button=>button.getAttribute('aria-checked')==='true')"),true);
  assert.equal(await evaluate("document.querySelector('.layer-controls .toggle-row').getAttribute('aria-checked')"),'false');
  assert.ok(await positions()>0,'Reset filters leaves portrait positions intact');
  await click('.reset-positions');await waitFor("document.querySelector('.reset-positions').disabled");assert.equal(await positions(),0);
  for(const locale of ['en','fa']) {
    if(await evaluate('document.documentElement.lang')!==locale) await click('[data-testid=language-switcher]');
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3')");
    for(const width of [1920,1440,1000,760,390,320]) {
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<=760});
      await evaluate("document.querySelector('.map-subbar').scrollIntoView({block:'center',behavior:'instant'})");
      assert.equal(await evaluate("(()=>{const b=document.querySelector('.map-subbar').getBoundingClientRect(),v=document.querySelector('.map-view-label').getBoundingClientRect();return Math.abs(b.x+b.width/2-v.x-v.width/2)<1.5})()"),true,`${locale}/${width} metadata is centered`);
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
      await click('.map-subbar .map-type-trigger');
      assert.equal(await evaluate("(()=>{const r=document.querySelector('.map-type-options').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth+1})()"),true);
      await key('Escape');
      if([1920,390].includes(width)) await screenshot(`map-controls-${locale}-${width}`);
    }
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
  await evaluate("localStorage.setItem('atlas-map-tour-v1','done');document.querySelector('.map-experience').requestFullscreen=async()=>{throw new Error('QA fallback')}");
  await click('[data-tour=fullscreen]');await waitFor("document.querySelector('.map-expanded')");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.map-subbar')).display"),'none');
  assert.equal(await evaluate("Boolean(document.querySelector('.map-expanded .inspector .region-filter')) && Boolean(document.querySelector('.map-expanded .inspector .reset-positions'))"),true);
  await toggle(0,false);await toggle(0,true);await screenshot('map-controls-fullscreen');await click('[data-tour=fullscreen]');

  await navigate(`${fixtureOrigin}?fixture=custom-accent`);await waitFor("document.querySelector('.atlas-app[data-ready=true]')");
  const sections=await evaluate("document.querySelectorAll('.appearance-controls .control-section-title').length");
  assert.equal(sections,4);
  for(let index=0;index<sections;index++) {
    await evaluate(`document.querySelectorAll('.appearance-controls .control-section-title')[${index}].focus()`);await key('Enter');
    assert.equal(await evaluate(`document.querySelectorAll('.appearance-controls .control-section-content')[${index}].hidden`),true);
    await key('Enter');assert.equal(await evaluate(`document.querySelectorAll('.appearance-controls .control-section-content')[${index}].hidden`),false);
  }
  console.log('PASS: map title/subbar and centered metadata, region in map controls, separate 11px reset actions, saved portrait reset, keyboard collapsible sections preserving values, appearance sections, RTL/mobile and fullscreen.');
}
