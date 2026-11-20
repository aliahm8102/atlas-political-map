import assert from "node:assert/strict";

export async function runMapPanelsQA({ cdp, evaluate, waitFor, click, navigate, screenshot }) {
  const key = async (key,code=key,extra={}) => {
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,...extra,...(key==='Enter'?{text:'\r'}:{})});
    await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,...extra});
  };
  const setDate = async(year,month=0)=>{
    await evaluate(`(()=>{const el=document.querySelector('.timeline-slider input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'${year*12+month}');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await waitFor(`document.querySelector('.map-stage').dataset.boundaryDate==='${year}-${String(month+1).padStart(2,'0')}-01'`);
  };
  await evaluate("localStorage.setItem('atlas-map-tour-v1','done')");
  await navigate('/workspace#country-364');
  await waitFor("document.querySelector('[data-country-profile=\"364\"]') && document.querySelector('.timeline-slider input')");
  await setDate(2025);
  assert.equal(await evaluate("document.querySelector('.country-profile-disclosure').open"),false);
  assert.equal(await evaluate("document.querySelector('.country-profile').getBoundingClientRect().height"),0);
  assert.ok(await evaluate("document.querySelector('.country-profile-trigger img').getAttribute('src')"));
  await evaluate("document.querySelector('.country-profile-trigger').focus()");await key('Enter');
  await waitFor("document.querySelector('.country-profile-disclosure').open");
  assert.ok(await evaluate("document.querySelector('.country-facts').getBoundingClientRect().height>0"));
  await click('.country-profile .disclosure-close');
  assert.equal(await evaluate("document.querySelector('.country-profile-disclosure').open"),false);
  assert.equal(await evaluate("document.activeElement.classList.contains('country-profile-trigger')"),true);
  assert.equal(await evaluate("document.querySelector('.country-people-disclosure').open"),false);
  assert.equal(await evaluate("document.querySelector('.country-people').getBoundingClientRect().height"),0);
  await click('.country-people-trigger');
  await waitFor("document.querySelector('.country-people-disclosure').open");
  assert.ok(await evaluate("document.querySelector('.mini-person .portrait').getBoundingClientRect().width>=40"));
  const next=await evaluate("document.querySelector('.mini-person strong').textContent");
  await click('.mini-person');
  await waitFor(`document.querySelector('.person-spotlight h3').textContent===${JSON.stringify(next)}`);
  assert.ok(await evaluate("document.querySelector('.spotlight-portrait').getBoundingClientRect().width>=88"));
  assert.ok(await evaluate("document.querySelector('.map-pin').getBoundingClientRect().width>=42"));
  assert.ok(await evaluate("parseFloat(getComputedStyle(document.querySelector('.portrait-fallback')).fontSize)>11"));
  await click('.country-people .disclosure-close');
  assert.equal(await evaluate("document.querySelector('.country-people-disclosure').open"),false);
  assert.equal(await evaluate("document.activeElement.classList.contains('country-people-trigger')"),true);
  await setDate(1980);
  await waitFor("document.querySelector('.country') && document.querySelector('.map-boundary-status')");
  assert.equal(await evaluate("document.querySelector('.map-boundary-status').getBoundingClientRect().height"),0);
  assert.equal(await evaluate("document.querySelector('.country-profile-trigger img')"),null,'Missing annual flags use a globe instead of a modern flag');
  await setDate(2025);
  await evaluate("document.querySelector('.global-search input').focus()");
  await key('f','KeyF');assert.equal(await evaluate("!!document.querySelector('.map-expanded')"),false);
  await evaluate("document.activeElement.blur()");
  await key('f','KeyF',{modifiers:2});assert.equal(await evaluate("!!document.querySelector('.map-expanded')"),false);
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',code:'KeyF',repeat:true,bubbles:true}))");
  assert.equal(await evaluate("!!document.querySelector('.map-expanded')"),false);
  await click('.help-button');await key('f','KeyF');assert.equal(await evaluate("!!document.querySelector('.map-expanded')"),false);
  assert.ok(await evaluate("Boolean(document.querySelector('.help-modal a[href*=creativecommons]'))"));
  await click('.modal-inner header button');
  await evaluate("document.querySelector('.map-experience').requestFullscreen=async()=>{throw new Error('QA fallback')};document.activeElement.blur()");
  await key('f','KeyF');await waitFor("document.querySelector('.map-experience').dataset.fullscreen==='fallback'");
  await click('.country-profile-trigger');await click('.country-people-trigger');
  await screenshot('map-panels-desktop');
  await key('F','KeyF');await waitFor("!document.querySelector('.map-expanded')");
  await evaluate("delete document.querySelector('.map-experience').requestFullscreen;document.activeElement.blur()");
  await cdp('Browser.setPermission',{permission:{name:'fullscreen',allowWithoutGesture:true},setting:'granted',origin:await evaluate('location.origin')});
  await key('ب','KeyF');await waitFor("document.querySelector('.map-experience').dataset.fullscreen==='native'");
  await key('f','KeyF');await waitFor("!document.querySelector('.map-expanded')");
  await navigate('/workspace#country-276');
  await waitFor("document.querySelector('[data-country-profile=\"276\"]')");
  assert.equal(await evaluate("document.querySelector('.country-profile-disclosure').open"),false,'New countries start collapsed');
  await click('[data-testid=language-switcher]');
  await waitFor("document.documentElement.lang==='fa'");
  assert.ok(await evaluate("document.querySelector('.country-people-trigger').textContent.includes('دیگر افراد کشور')"));
  for(const [width,height] of [[390,844],[844,390]]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    await evaluate("document.activeElement.blur()");await key('f','KeyF');assert.equal(await evaluate("!!document.querySelector('.map-expanded')"),false);
    if(!await evaluate("document.querySelector('.country-profile-disclosure').open")) await click('.country-profile-trigger');
    if(!await evaluate("document.querySelector('.country-people-disclosure').open")) await click('.country-people-trigger');
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3');document.querySelector('.inspector').scrollIntoView({block:'center',behavior:'instant'})");
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
    await screenshot(`map-panels-fa-${width}`);
    await click('.country-profile .disclosure-close');await click('.country-people .disclosure-close');
  }
  console.log('PASS: desktop F/native/fallback fullscreen, typing/modifier/repeat/dialog/mobile guards, flag/profile and people disclosures with close/focus, larger portraits, hidden boundary status and RTL/mobile layouts.');
}
