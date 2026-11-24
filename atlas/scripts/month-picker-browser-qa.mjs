import assert from "node:assert/strict";

export async function runMonthPickerQA({ evaluate, cdp, click, input, waitFor, navigate, screenshot, fixtureOrigin }) {
  await navigate(`${fixtureOrigin}?fixture=month-picker`);
  await waitFor("document.querySelector('.month-picker-trigger')");
  const first='.month-picker-trigger';
  const value=()=>evaluate("JSON.parse(document.querySelector('#test-month-range').textContent)");
  const key=async(key)=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,...(key==='Enter'?{text:'\r'}:{})});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});};
  const select=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const open=async()=>{await click(first);await waitFor("document.querySelector('.month-picker-panel')");};
  assert.equal(await evaluate("document.querySelector('input[type=month]')"),null,'No browser-owned month picker remains');
  await open();
  assert.equal(await evaluate("document.querySelector('.month-picker-year input').value"),'2025');
  assert.equal(await evaluate("document.activeElement.dataset.monthOption"),'2025-03');
  assert.equal(await evaluate("document.querySelector('[data-month-option=\"2025-03\"]').getAttribute('aria-pressed')"),'true');
  await key('ArrowRight');assert.equal(await evaluate("document.activeElement.dataset.monthOption"),'2025-04');
  await key('ArrowUp');assert.equal(await evaluate("document.activeElement.dataset.monthOption"),'2024-12');
  await key('PageDown');assert.equal(await evaluate("document.activeElement.dataset.monthOption"),'2025-12');
  await key('Home');await key('Enter');
  assert.equal((await value()).from,'2025-01');
  assert.equal(await evaluate("document.activeElement.classList.contains('month-picker-trigger')"),true);
  await open();await input('.month-picker-year input','1847');
  assert.equal(await evaluate("[...document.querySelectorAll('.month-picker-grid button')].every(button=>button.disabled)"),true);
  await input('.month-picker-year input','1848');await click('[data-month-option="1848-01"]');
  assert.equal((await value()).from,'1848-01');
  await open();
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Previous year\"]').disabled"),true);
  const maximum=await evaluate("document.querySelector('.month-picker-year input').max");
  await input('.month-picker-year input',maximum);
  const lastMonth=await evaluate('new Date().getMonth()');
  assert.equal(await evaluate(`[...document.querySelectorAll('.month-picker-grid button')].every((button,index)=>button.disabled===(index>${lastMonth}))`),true);
  await key('Escape');assert.equal(await evaluate("document.querySelector('.month-picker-panel')"),null);
  await open();await click('.month-picker-footer button');assert.equal((await value()).from,'');
  assert.equal(await evaluate("Boolean(document.querySelector('.directory-date-range .form-error'))"),true);
  await open();await click('.month-picker-footer button:last-child');
  assert.equal((await value()).from,await evaluate("`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`"));
  const current=(await value()).from;
  await click('.directory-month-field:last-child .month-picker-trigger');
  await input('.month-picker-year input',current.slice(0,4));await click(`[data-month-option="${current}"]`);
  assert.equal((await value()).to,current,'The end field updates independently');
  await open();await evaluate("document.querySelector('#test-month-outside').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
  await waitFor("!document.querySelector('.month-picker-panel')");
  await open();for(let i=0;i<5 && await evaluate("Boolean(document.querySelector('.month-picker-panel'))");i++) await key('Tab');
  assert.equal(await evaluate("Boolean(document.querySelector('.month-picker-panel'))"),false,'Tab can leave the nonmodal picker');
  await select('#test-month-font','130');
  for(const locale of ['en','fa']) {
    if(await evaluate('document.documentElement.lang')!==locale) await click('[data-testid=language-switcher]');
    for(const theme of ['light','dark','sand','midnight']) {
      await select('#test-month-theme',theme);
      for(const width of [900,390,320]) {
        await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<761});
        await evaluate("document.querySelector('.directory-date-range').scrollIntoView({block:'start',behavior:'instant'})");
        await open();
        await evaluate("(async()=>{await Promise.all(document.querySelector('.month-picker-panel').getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{})))})()");
        assert.equal(await evaluate("(()=>{const p=document.querySelector('.month-picker-panel'),r=p.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth+1 && r.top>=0 && r.bottom<=innerHeight+1 && p.scrollWidth<=p.clientWidth+1})()"),true,`${locale}/${theme}/${width} popup fits viewport`);
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.month-picker-panel')).backgroundColor===getComputedStyle(document.querySelector('.directory-date-range')).backgroundColor"),true,'Popup uses the site surface color');
        assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
        if(locale==='fa') assert.ok((await evaluate("document.querySelector('.month-picker-grid').textContent")).includes('مارس'));
        await screenshot(`month-picker-${locale}-${theme}-${width}`);
        await key('Escape');
      }
    }
  }
  for(const accent of ['sage','blue','lavender','amber','rose']) {
    await select('#test-month-accent',accent);await open();
    await evaluate("(async()=>{await Promise.all(document.querySelector('.month-picker-grid [aria-pressed=true]').getAnimations().map(animation=>animation.finished.catch(()=>{})))})()");
    assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.month-picker-grid [aria-pressed=true]')).backgroundColor"),await evaluate("getComputedStyle(document.querySelector('.month-picker-grid [aria-pressed=false]:not(:disabled)')).backgroundColor"));
    await key('Escape');
  }
  await open();
  const focused=Number(await evaluate('document.activeElement.dataset.monthIndex'));
  await key('ArrowLeft');assert.equal(Number(await evaluate('document.activeElement.dataset.monthIndex')),focused+1,'Horizontal navigation follows RTL');await key('Escape');
  await cdp('Emulation.setDeviceMetricsOverride',{width:900,height:844,deviceScaleFactor:1,mobile:false});
  await evaluate("document.querySelector('.directory-date-range').style.marginTop='620px';window.scrollTo({top:0,behavior:'instant'})");
  await open();assert.equal(await evaluate("document.querySelector('.month-picker-panel').classList.contains('is-above')"),true,'Picker flips above a trigger near the bottom');
  assert.equal(await evaluate("(()=>{const r=document.querySelector('.month-picker-panel').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight})()"),true);
  await key('Escape');
  await evaluate("document.querySelector('.directory-date-range').style.marginTop='0';window.scrollTo({top:0,behavior:'instant'})");
  await cdp('Emulation.setDeviceMetricsOverride',{width:900,height:360,deviceScaleFactor:1,mobile:false});
  await open();
  const short=await evaluate("(()=>{const el=document.querySelector('.month-picker-panel'),p=el.getBoundingClientRect(),m=document.activeElement.getBoundingClientRect();return {top:p.top,bottom:p.bottom,height:innerHeight,focusTop:m.top,focusBottom:m.bottom,scroll:el.scrollTop,option:document.activeElement.dataset.monthOption}})()");
  assert.equal(short.top>=0 && short.bottom<=short.height+1 && short.focusTop>=short.top && short.focusBottom<=short.bottom+1,true,`A short viewport scrolls the focused month inside the popup: ${JSON.stringify(short)}`);
  await key('Escape');
  console.log('PASS: themed month/year popup, selected month, keyboard year/month navigation, min/max bounds, clear/current month, outside/Escape/Tab dismissal, both languages, all themes/accents and 320px layouts at 130% font size.');
}
