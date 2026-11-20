import assert from "node:assert/strict";
import { selectMonthQA } from "./select-month-qa.mjs";

export async function runDirectoriesNavigationQA({ cdp, evaluate, waitFor, click, type, screenshot }) {
  const select = async (selector,value) => {
    if (await evaluate(`document.querySelector(${JSON.stringify(selector)}).classList.contains("month-picker-trigger")`)) return selectMonthQA({ evaluate, click, waitFor }, selector, value);
    return evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  };
  const key = async (code,key=code.slice(3).toLowerCase(),modifiers=0) => {
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',code,key,modifiers});
    await cdp('Input.dispatchKeyEvent',{type:'keyUp',code,key,modifiers});
  };
  const view = () => evaluate("document.querySelector('.world-map > g').getAttribute('transform')");
  await evaluate("document.cookie='atlas-map-tour-v1=done;path=/;max-age=86400';localStorage.setItem('atlas-map-tour-v1','done')");
  assert.equal(await evaluate("document.querySelector('.brand').textContent"),'Atlas Peyma');
  assert.equal(await evaluate("document.querySelectorAll('.nav-active-dot').length"),0);
  for (const width of [1440,900]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3')");
    assert.equal(await evaluate("(() => {const sidebar=document.querySelector('.sidebar'),css=getComputedStyle(sidebar);return sidebar.querySelector('.brand').scrollWidth<=sidebar.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)})()"),true,'English brand fits the sidebar');
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
  await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1')");
  await evaluate("[...document.querySelectorAll('nav button')].find(el=>el.textContent.includes('Directories')).click()");
  await waitFor("document.querySelector('#directory-tab-countries')");
  assert.equal(await evaluate("document.querySelector('.page-heading h1').textContent"),'Directories');
  await evaluate("document.querySelector('#directory-tab-people').focus()");
  await key('ArrowRight','ArrowRight');
  assert.equal(await evaluate("document.activeElement.id"),'directory-tab-countries');
  await click('#directory-tab-countries');
  await select('[aria-label="Directory date"]','2025-01');
  await select('[aria-label="Directory end date"]','2025-01');
  await waitFor("document.querySelector('.country-card[data-country-code=\"276\"]')");
  await type('.country-directory-search input','Berlin');
  await waitFor("document.querySelectorAll('.country-card').length===1 && document.querySelector('.country-card h3').textContent==='Germany'");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.country-card dd')].map(el=>el.textContent)"),['Berlin','357,022','83,491,249']);
  assert.match(await evaluate("document.querySelector('.country-card img').getAttribute('src')"),/\S/);
  assert.equal(await evaluate("document.querySelector('.country-card a').getAttribute('href')"),'/workspace#country-276');
  await select('[aria-label="Directory region"]','Asia');
  await waitFor("document.querySelectorAll('.country-card').length===0");
  await select('[aria-label="Directory region"]','All regions');
  await type('.country-directory-search input','');
  await select('[aria-label="Directory date"]','1980-01');
  await select('[aria-label="Directory end date"]','1980-01');
  await waitFor("document.querySelector('.country-card[data-country-code=\"hist-ussr\"]')");
  await select('[aria-label="Directory date"]','2025-01');
  await select('[aria-label="Directory end date"]','2025-01');
  await waitFor("!document.querySelector('.country-card[data-country-code=\"hist-ussr\"]')");
  await click('#directory-tab-people');
  await waitFor("document.querySelector('.person-card[data-person-id]') && document.querySelector('#directory-group-name')");
  await click('#directory-tab-countries');
  await type('.country-directory-search input','Germany');
  await click('.country-card a');
  await waitFor("location.hash==='#country-276' && document.querySelector('[data-country-profile=\"276\"]')");
  const noPan = async action => {const previous=await view();await action();assert.equal(await view(),previous);};
  const before = await view(); await key('KeyD'); assert.equal(await view(),before,'WASD is inactive outside fullscreen');
  await cdp('Browser.setPermission',{permission:{name:'fullscreen',allowWithoutGesture:true},setting:'granted',origin:await evaluate('location.origin')});
  await evaluate("document.querySelector('.map-experience').requestFullscreen()");
  await waitFor("document.querySelector('.map-experience').dataset.fullscreen==='native'");
  await evaluate("document.activeElement.blur()");
  const native=await view(); await key('KeyD'); assert.notEqual(await view(),native,'Native fullscreen also pans');
  await click('[data-tour=fullscreen]');
  await waitFor("!document.querySelector('.map-expanded')");
  await noPan(()=>key('KeyD'));
  // Also exercise the fallback used when the browser rejects fullscreen.
  await evaluate("document.querySelector('.map-experience').requestFullscreen=async()=>{throw new Error('QA fallback')}");
  await click('[data-tour=fullscreen]');
  await waitFor("document.querySelector('.map-experience').dataset.fullscreen==='fallback'");
  await evaluate("document.activeElement.blur()");
  for (const [code,index,sign,keyText] of [['KeyW',1,1,'w'],['KeyS',1,-1,'S'],['KeyA',0,1,'\u0634'],['KeyD',0,-1,'d']]) {
    const previous = await view(); await key(code,keyText);
    await waitFor(`document.querySelector('.world-map > g').getAttribute('transform')!==${JSON.stringify(previous)}`);
    const numbers=value=>value.match(/translate\(([^,]+),([^)]+)\)/).slice(1).map(Number);
    assert.ok((numbers(await view())[index]-numbers(previous)[index])*sign>0,`${code} pans in the correct direction`);
  }
  await noPan(()=>key('KeyD','d',2)); // Ctrl+D stays a browser shortcut.
  await click('[aria-label="Highlight characters"]');
  await evaluate("document.querySelector('.map-highlight-picker input').focus()");
  await noPan(()=>key('KeyA'));
  await type('.map-highlight-picker input','wasd');
  assert.equal(await evaluate("document.querySelector('.map-highlight-picker input').value"),'wasd');
  await click('.map-highlight-picker .icon-button');
  await evaluate("document.querySelector('.map-stage').focus()");
  const previous=await view(); await key('ArrowLeft','ArrowLeft');
  assert.notEqual(await view(),previous,'Existing arrow panning still works');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await noPan(()=>key('KeyD'));
  await click('[data-tour=fullscreen]');
  await waitFor("!document.querySelector('.map-expanded')");
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
  await click('[data-testid=language-switcher]');
  await waitFor("document.querySelector('.brand').textContent==='\u0627\u0637\u0644\u0633 \u067e\u06cc\u0645\u0627'");
  await evaluate("document.querySelectorAll('nav')[0].querySelectorAll('button')[1].click()");
  await waitFor("document.querySelector('.page-heading h1').textContent==='\u0641\u0647\u0631\u0633\u062a\u200c\u0647\u0627'");
  await click('#directory-tab-countries');
  await type('.country-directory-search input','\u0628\u0631\u0644\u06cc\u0646');
  await waitFor("document.querySelectorAll('.country-card').length===1 && document.querySelector('.country-card h3').textContent==='\u0622\u0644\u0645\u0627\u0646'");
  for (const width of [1440,900,390,320]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<761});
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3')");
    if(width<761) await click('[data-tour=mobile-navigation]');
    assert.equal(await evaluate("(() => {const s=document.querySelector('.sidebar'),b=s.querySelector('.brand'),r=b.getBoundingClientRect(),p=s.getBoundingClientRect(),css=getComputedStyle(s);return b.scrollWidth<=s.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight) && r.left>=p.left+parseFloat(css.paddingLeft)-1 && r.right<=p.right-parseFloat(css.paddingRight)+1})()"),true,'Brand fits sidebar at 130% text');
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true,'No horizontal page overflow');
    await screenshot(`directories-fa-${width}`);
    if(width<761) await click('.sidebar-scrim');
  }
  console.log('PASS: renamed sidebar/brand, people/country directories, annual facts, bilingual country/capital search, region/date filters, historical identities, map links, native/fallback WASD, editing/modifier/mobile guards and responsive layouts.');
}
