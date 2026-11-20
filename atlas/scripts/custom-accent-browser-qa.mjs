import assert from "node:assert/strict";

export async function runCustomAccentQA({ evaluate, cdp, click, input, waitFor, navigate, screenshot, fixtureOrigin }) {
  const url=`${fixtureOrigin}?fixture=custom-accent`;
  await navigate(url);await waitFor("document.querySelector('.atlas-app[data-ready=true]') && document.querySelector('.accent-choice.custom')");
  const saved=()=>evaluate("JSON.parse(localStorage.getItem('atlas-local-v1:fixture-accent')).settings");
  const intercept=()=>evaluate("window.accentPickerClicks=0;document.querySelector('[name=custom-accent-color]').onclick=event=>{event.preventDefault();window.accentPickerClicks++}");
  const key=async key=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,...(key==='Enter'?{text:'\r'}:{})});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});};
  const nativeColor=value=>input('[name="custom-accent-color"]',value);
  const settle=()=>evaluate("(async()=>{const el=document.querySelector('#test-accent-preview');getComputedStyle(el).backgroundColor;await Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{})))})()");
  const readable=()=>evaluate(`(()=>{const s=getComputedStyle(document.querySelector('#test-accent-preview'));const luminance=color=>{const [r,g,b]=color.match(/\\d+/g).slice(0,3).map(Number).map(v=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};const a=luminance(s.color),b=luminance(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5})()`);
  assert.equal(await evaluate("document.querySelectorAll('.accent-choice').length"),6);
  assert.match(await evaluate("getComputedStyle(document.querySelector('.accent-choice.custom')).backgroundImage"),/linear-gradient/);
  await intercept();await evaluate("document.querySelector('.accent-choice.custom').focus()");await key('Enter');
  await waitFor("document.querySelector('.custom-accent-rgb') && document.querySelector('.atlas-app').dataset.accent==='custom'");
  assert.equal(await evaluate('window.accentPickerClicks'),1,'Keyboard activation opens the native colour input');
  for(const [selector,value] of [['Red (R)','211'],['Green (G)','92'],['Blue (B)','55']]) await input(`[aria-label="${selector}"]`,value);
  await waitFor("document.querySelector('.custom-accent-rgb output').textContent==='RGB(211, 92, 55)'");
  assert.equal((await saved()).customAccent,'#d35c37');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.custom-accent-preview')).backgroundColor"),'rgb(211, 92, 55)');
  await evaluate("document.querySelector('[aria-label=\"Red (R)\"]').focus()");
  await input('[aria-label="Red (R)"]','256');assert.equal((await saved()).customAccent,'#d35c37');
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Red (R)\"]').getAttribute('aria-invalid')"),'true');
  await evaluate("document.querySelector('#test-accent-preview').focus()");
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Red (R)\"]').value"),'211');
  await nativeColor('#123456');
  await waitFor("document.querySelector('.custom-accent-rgb output').textContent==='RGB(18, 52, 86)'");
  assert.equal((await saved()).customAccent,'#123456');
  await navigate(url);await waitFor("document.querySelector('.atlas-app[data-ready=true][data-accent=custom]') && document.querySelector('.custom-accent-rgb')");
  assert.equal(await evaluate("document.querySelector('[name=custom-accent-color]').value"),'#123456');
  await click('.accent-choice.blue');
  assert.equal(await evaluate("document.querySelector('.atlas-app').style.getPropertyValue('--accent')"),'');
  assert.equal((await saved()).customAccent,'#123456','Preset switches remember the previous custom RGB');
  await intercept();await click('.accent-choice.custom');
  await click('[data-testid=language-switcher]');await waitFor("document.documentElement.lang==='fa'");
  assert.equal(await evaluate("document.querySelector('.accent-choice.custom > span').textContent"),'رنگ شما');
  await input('.font-size-control input','130');
  for(const theme of ['light','dark','sand','midnight']) {
    await click(`.theme-choice.${theme}`);
    for(const color of ['#000000','#ffffff','#d35c37']) {await nativeColor(color);await settle();assert.equal(await readable(),true,`${theme}/${color} primary action stays readable`);}
    for(const width of [390,320]) {
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});
      await evaluate("document.querySelector('.accent-choices').scrollIntoView({block:'start',behavior:'instant'})");
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
      assert.match(await evaluate("getComputedStyle(document.querySelector('.accent-choice.custom')).backgroundImage"),/linear-gradient/);
      await screenshot(`custom-accent-${theme}-fa-${width}`);
    }
  }
  await click('.appearance-controls > .secondary-button');
  assert.equal((await saved()).accent,'sage');assert.equal((await saved()).customAccent,'#547b63');
  await click('[data-testid=language-switcher]');await waitFor("document.documentElement.lang==='en'");
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
  await evaluate("localStorage.setItem('atlas-map-tour-v1','done');document.querySelector('.map-experience').requestFullscreen=async()=>{throw new Error('QA fallback')}");
  await click('[data-tour=fullscreen]');await waitFor("document.querySelector('.map-expanded')");
  await click('[data-map-tour=drawing-toggle]');await waitFor("document.querySelector('.pencil-custom-color input')");
  assert.match(await evaluate("getComputedStyle(document.querySelector('.pencil-custom-color')).backgroundImage"),/linear-gradient/);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.pencil-custom-color input')).opacity"),'0');
  await evaluate("document.querySelector('.pencil-custom-color input').focus()");
  assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.pencil-custom-color')).outlineStyle"),'none');
  await input('.pencil-custom-color input','#12ab34');
  const point=await evaluate("(()=>{const r=document.querySelector('.map-drawing').getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.5}})()");
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+65,y:point.y+25,button:'left',buttons:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+65,y:point.y+25,button:'left',clickCount:1});
  await waitFor("document.querySelector('[data-pencil-stroke]')");
  assert.equal(await evaluate("document.querySelector('[data-pencil-stroke]').getAttribute('stroke')"),'#12ab34');
  await screenshot('custom-pencil-rainbow');
  await click('[data-tour=fullscreen]');
  console.log('PASS: rainbow accent/native picker activation, exact RGB editing/validation, saved settings/reload, preset/reset behaviour, all themes and mobile RTL at 130%, rainbow pencil control and drawing with its chosen colour.');
}
