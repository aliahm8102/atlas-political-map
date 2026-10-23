import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const origin = process.env.ATLAS_TEST_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname), "Use the local demo server");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-map-tour-"));
const chrome = spawn(process.env.ATLAS_CHROME_BIN || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome"), ["--headless=new", "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
let socket;
let diagnostics;
let sequence = 0;
const pending = new Map();
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await fs.readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0].trim(); break; } catch { await delay(100); }
  }
  assert.ok(port, "Chrome started");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(String(data));
    const handler = pending.get(message.id);
    if (handler) {
      pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
    }
  });
  const cdp = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 30000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const evaluate = async (expression) => {
    const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(150); }
    throw new Error(`Timed out waiting for ${expression}`);
  };
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  const exceptions = [];
  socket.addEventListener("message", ({ data }) => { const message = JSON.parse(String(data)); if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text); });
  const navigate = async path => { await cdp("Page.navigate", { url: `${origin}${path}` }); };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const type = async (selector, value) => {
    await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); input.focus(); input.select(); })()`);
    await cdp("Input.insertText", { text: value });
  };
  const key = async (key, code = key, modifiers = 0) => { const windowsVirtualKeyCode = ({ Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, Tab: 9, k: 75 })[key]; await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers, windowsVirtualKeyCode, ...(key === "Enter" ? { text: "\r" } : {}) }); await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode }); };
  const screenshot = async name => { await fs.mkdir("outputs", { recursive: true }); const shot = await cdp("Page.captureScreenshot", { format: "png" }); await fs.writeFile(`outputs/${name}.png`, Buffer.from(shot.data, "base64")); };
  diagnostics = async () => { await screenshot("map-tour-failure"); return evaluate("({url:location.pathname+location.search,heading:document.querySelector('h1')?.textContent,body:document.body.innerText.slice(-800),tour:[...document.querySelectorAll('.tour-panel,.tour-copy,.tour-symbol,.tour-actions,.tour-actions .primary-button')].map(el=>({cls:el.className,rect:el.getBoundingClientRect().toJSON(),display:getComputedStyle(el).display,shrink:getComputedStyle(el).flexShrink,maxHeight:getComputedStyle(el).maxHeight})),media:matchMedia('(max-width:760px)').matches,viewport:[innerWidth,innerHeight],hasCss:[...document.styleSheets].some(sheet=>{try{return [...sheet.cssRules].some(rule=>rule.cssText.includes('.map-tools-tour .tour-panel'))}catch{return false}})})"); };
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await navigate("/workspace/search?q=Iran");
  await waitFor("location.pathname === '/login' && document.querySelector('.auth-card')");
  await waitFor("document.querySelector('.auth-page')?.dataset.authMode === 'local'");
  await waitFor("(() => { if(document.querySelector('button[aria-label=\"Hide password\"]')) return true; document.querySelector('button[aria-label=\"Show password\"]')?.click(); return false; })()");
  await click('button[aria-label="Hide password"]');
  const credentials = Object.fromEntries((await fs.readFile(".env.demo.local", "utf8")).split(/\r?\n/).filter(line => line && !line.startsWith("#")).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
  await type('input[autocomplete="email"]', credentials.ATLAS_DEMO_EMAIL);
  await type('input[autocomplete="current-password"]', credentials.ATLAS_DEMO_PASSWORD);
  await click('.auth-submit');
  await waitFor("location.pathname === '/workspace' && document.querySelector('.world-map') && document.querySelector('.global-search input')");
  const welcome = kind => waitFor(`document.querySelector('.${kind}-tour.tour-welcome[open]')`);
  const step = (kind,index) => waitFor(`document.querySelector('.${kind}-tour .tour-panel[data-tour-step="${index}"]') && document.querySelector('.${kind}-tour .tour-highlight')`);
  const next = () => click('.tour-dialog .primary-button');
  const skip = () => click('.tour-dialog .secondary-button');
  const ready = () => waitFor("(() => {window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true}));return document.activeElement === document.querySelector('.global-search input');})()");
  const settled = () => evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  const bounds = async () => {
    await settled();
    assert.equal(await evaluate("(() => {const r=document.querySelector('.tour-panel').getBoundingClientRect(),b=document.querySelector('.tour-actions .primary-button').getBoundingClientRect(),h=document.querySelector('.tour-highlight')?.getBoundingClientRect();return r.left>=0 && r.top>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1 && b.bottom<=innerHeight+1 && (!h || h.width>0 && h.height>0);})()"), true, 'Tour and its buttons remain visible with a usable highlight');
  };
  const exit = async () => {
    await click('[data-tour="fullscreen"]');
    await waitFor("!document.querySelector('.map-expanded') && !document.fullscreenElement");
    await settled();
    assert.notEqual(await evaluate("getComputedStyle(document.body).overflow"), 'hidden', 'Exiting fullscreen releases page scrolling');
  };
  const replay = async () => {
    await ready();
    if (await evaluate("innerWidth<=760 && !document.querySelector('.sidebar.open')")) await click('[data-tour="mobile-navigation"]');
    await click('[data-tour="about"]');
    await waitFor("document.querySelector('.replay-tour-button')");
    await click('.replay-tour-button'); await welcome('site');
    assert.equal(await evaluate("['atlas-tour-v1','atlas-map-tour-v1'].every(key=>localStorage.getItem(key)===null && !document.cookie.includes(key+'=done'))"), true, 'Replay resets both tours in both storage methods');
  };
  await welcome('site');
  assert.match(await evaluate("document.querySelector('.tour-description').textContent"), /political roles connect over time/);
  await next();
  for (let i=0;i<7;i++) { await step('site',i); await next(); }
  await step('site',7);
  assert.equal(await evaluate("document.querySelector('.tour-actions .primary-button').textContent.includes('Open map')"), true);
  await next();
  await waitFor("document.fullscreenElement === document.querySelector('.map-experience')");
  await welcome('map-tools');
  assert.equal(await evaluate("document.fullscreenElement.contains(document.querySelector('.map-tools-tour'))"), true, 'Tools tour is inside the native fullscreen element');
  assert.equal(await evaluate("localStorage.getItem('atlas-tour-v1')==='done' && localStorage.getItem('atlas-map-tour-v1')===null"), true, 'Tours have independent completion markers');
  await screenshot('map-tour-welcome');
  const roles = await evaluate("[...document.querySelectorAll('.layer-row')].map(el=>el.getAttribute('aria-checked'))");
  const date = await evaluate("document.querySelector('.timeline-slider input').value");
  await next();
  for (let i=0;i<8;i++) {
    await step('map-tools',i); await bounds();
    if (i===1) assert.equal(await evaluate("Boolean(document.querySelector('.map-pencil-colors')) && document.querySelector('[data-map-tour=pencil]').getAttribute('aria-pressed')==='true'"), true);
    if (i===2) assert.equal(await evaluate("document.querySelector('[data-map-tour=eraser]').getAttribute('aria-pressed')"), 'true');
    if (i===3) assert.equal(await evaluate("document.querySelector('[data-map-tour=ruler]').getAttribute('aria-pressed')"), 'true');
    if (i===5) await screenshot('map-tour-settings');
    if (i===7) await screenshot('map-tour-timeline');
    await next();
  }
  await waitFor("!document.querySelector('.map-tools-tour') && localStorage.getItem('atlas-map-tour-v1')==='done' && document.cookie.includes('atlas-map-tour-v1=done')");
  assert.equal(await evaluate("document.querySelector('[data-map-tour=drawing-toggle]').getAttribute('aria-expanded')==='false' && document.querySelector('[data-map-tour=settings]').getAttribute('aria-expanded')==='true' && document.querySelector('[data-map-tour=timeline]').getAttribute('aria-expanded')==='true'"), true, 'Tour restores the previous tool and panel states');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.layer-row')].map(el=>el.getAttribute('aria-checked'))"), roles);
  assert.equal(await evaluate("document.querySelector('.timeline-slider input').value"), date);
  await exit();
  await click('[data-tour="fullscreen"]');
  await waitFor("document.querySelector('.map-expanded')"); await settled();
  assert.equal(await evaluate("document.querySelector('.map-tools-tour')===null"), true, 'Completed tools tour does not repeat on re-entry');
  await exit();
  await replay(); await skip();
  await waitFor("!document.querySelector('.tour-dialog')");
  assert.equal(await evaluate("localStorage.getItem('atlas-map-tour-v1')===null"), true, 'Declining the site tour leaves the tools tour unseen');
  await click('[data-tour="fullscreen"]'); await welcome('map-tools');
  await next(); await step('map-tools',0);
  await key('Escape');
  await waitFor("!document.querySelector('.map-tools-tour') && localStorage.getItem('atlas-map-tour-v1')==='done'");
  if (await evaluate("Boolean(document.querySelector('.map-expanded'))")) await exit();
  await ready(); await click('[data-testid="language-switcher"]');
  await waitFor("document.documentElement.lang==='fa'");
  for (const [width,height] of [[320,640],[390,844],[844,390]]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3');document.querySelector('.map-experience').requestFullscreen=undefined");
    await replay();
    assert.equal(await evaluate("document.querySelector('.tour-description').textContent.includes('هدف اطلس')"), true);
    await next();
    for(let i=0;i<7;i++){await step('site',i);await next();}
    await step('site',7);
    assert.equal(await evaluate("document.querySelector('.tour-description').textContent"), 'نقشه رو باز کن تا سفر جدیدی رو آغاز کنیم');
    await next(); await welcome('map-tools');
    await waitFor("document.querySelector('.map-experience').dataset.fullscreen==='fallback'");
    await bounds(); await next();
    for(let i=0;i<8;i++){
      await step('map-tools',i); await bounds();
      if(i===3) assert.equal(await evaluate("(() => {const p=document.querySelector('.tour-panel').getBoundingClientRect(),h=document.querySelector('.tour-highlight').getBoundingClientRect();return p.right<=h.left || p.left>=h.right || p.bottom<=h.top || p.top>=h.bottom;})()"),true,'Tooltip leaves the ruler controls visible');
      if(i===1 || i===3) await screenshot(`map-tour-fa-${width}-${i}`);
      await next();
    }
    await waitFor("!document.querySelector('.map-tools-tour') && localStorage.getItem('atlas-map-tour-v1')==='done'");
    await exit();
  }
  assert.deepEqual(exceptions,[]);
  console.log('PASS: purpose and fullscreen handoff, independent one-time tours, replay reset, all drawing/settings/timeline steps, restored UI/data, native and fallback fullscreen, keyboard and Persian mobile layouts.');
  await cdp('Browser.close');
} catch(error){
  console.error('Map tour diagnostics:',await diagnostics?.().catch(()=>null));
  throw error;
} finally {socket?.close();chrome.kill();}
