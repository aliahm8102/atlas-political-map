import assert from "node:assert/strict";

export async function runMobileMapLockQA({evaluate,cdp,click,waitFor,navigate,screenshot,fixtureOrigin}) {
  await cdp('Fetch.enable',{patterns:[{urlPattern:'https://server.arcgisonline.com/*/tile/*'},{urlPattern:'https://tile.opentopomap.org/*'},{urlPattern:'https://tile.openstreetmap.org/*'}]});
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await navigate(fixtureOrigin);
  await waitFor("document.querySelector('.map-stage[data-interaction-locked=true]')");
  const view=()=>evaluate("document.querySelector('.world-map > g').getAttribute('transform')");
  const settle=()=>evaluate("new Promise(resolve=>setTimeout(resolve,250))");
  const point=async()=>{
    await evaluate("document.querySelector('.map-stage').scrollIntoView({block:'center',behavior:'instant'})");
    return evaluate("(()=>{const r=document.querySelector('.map-stage').getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.75}})()");
  };
  const swipe=async()=>{
    const p=await point();
    await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
    for(let step=1;step<=8;step++) await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y-step*10,id:1}]});
    await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await settle();
  };
  const pinch=async()=>{
    const p=await point();
    await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x-25,y:p.y,id:1},{x:p.x+25,y:p.y,id:2}]});
    for(let step=1;step<=5;step++) await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-25-step*5,y:p.y,id:1},{x:p.x+25+step*5,y:p.y,id:2}]});
    await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
  };
  const locked=async()=>{
    assert.equal(await evaluate("document.querySelector('.map-mobile-lock').getAttribute('aria-pressed')"),'true');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.map-stage')).touchAction"),'pan-y');
    const before=await view();
    await point();const scroll=await evaluate('scrollY');
    await swipe();
    assert.equal(await view(),before,'Locked map remains stationary during a real touch swipe');
    assert.ok(await evaluate('scrollY')>scroll,'The page scrolls over the locked map');
    const p=await point();
    await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:100});await settle();
    assert.equal(await view(),before,'Locked map ignores wheel zoom');
    await pinch();assert.equal(await view(),before,'Locked map ignores pinch zoom');
  };
  await locked();
  await click('.map-mobile-lock');
  await waitFor("document.querySelector('.map-stage[data-interaction-locked=false]')");
  await click('button[aria-label="Zoom in"]');
  const before=await view();await swipe();assert.notEqual(await view(),before,'Unlocking restores touch panning');
  const p=await point(),zoom=await view();
  await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:-100});await settle();
  assert.notEqual(await view(),zoom,'Unlocking restores wheel zoom');
  const pinchBefore=await view();await pinch();assert.notEqual(await view(),pinchBefore,'Unlocking restores pinch zoom');
  await click('.map-mobile-lock');
  await click('[data-testid=language-switcher]');
  assert.equal(await evaluate("document.querySelector('.map-mobile-lock').getAttribute('aria-label')"),'باز کردن قفل نقشه');
  for(const type of ['physical','topographic','satellite','political','default']) {
    await click('.map-subbar .map-type-trigger');await click(`[data-map-type="${type}"]`);
    await waitFor(type==='default'?"!document.querySelector('.leaflet-basemap')":`document.querySelector('.leaflet-basemap[data-basemap=${type}]')`);
    await locked();
  }
  await point();await screenshot('mobile-map-locked');
  await evaluate("localStorage.setItem('atlas-map-tour-v1','done');document.querySelector('.map-experience').requestFullscreen=async()=>{throw new Error('QA fallback')}");
  await click('[data-tour=fullscreen]');await waitFor("document.querySelector('.map-expanded')");
  assert.equal(await evaluate("(()=>{const b=document.querySelector('.map-mobile-lock'),r=b.getBoundingClientRect();return r.right<=innerWidth && r.top>=0 && document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.map-mobile-lock')===b})()"),true,'Lock is reachable at the top right in fullscreen');
  await click('.map-mobile-lock');assert.equal(await evaluate("document.querySelector('.map-stage').dataset.interactionLocked"),'false');
  await click('.map-mobile-lock');await click('[data-tour=fullscreen]');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await waitFor("document.querySelector('.map-stage[data-interaction-locked=false]')");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.map-mobile-lock')).display"),'none');
  await click('button[aria-label="بزرگ‌نمایی"]');
  console.log('PASS: mobile default lock, natural page scrolling, blocked gestures, unlock pan/zoom, all map types, localization and desktop controls.');
}
