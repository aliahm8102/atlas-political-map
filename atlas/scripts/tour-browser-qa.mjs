import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const origin = process.env.ATLAS_TEST_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname), "Use the local demo server");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-tour-"));
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
  diagnostics = async () => { await screenshot("tour-failure"); return evaluate("({url:location.pathname+location.search,heading:document.querySelector('h1')?.textContent,body:document.body.innerText.slice(-800)})"); };
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
  const welcome = () => waitFor("document.querySelector('.tour-dialog.tour-welcome[open]')");
  const step = index => waitFor(`document.querySelector('.tour-panel[data-tour-step="${index}"]') && document.querySelector('.tour-highlight')`);
  const done = () => waitFor("!document.querySelector('.tour-dialog') && localStorage.getItem('atlas-tour-v1') === 'done' && document.cookie.includes('atlas-tour-v1=done')");
  const ready = () => waitFor("(() => {window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true}));return document.activeElement === document.querySelector('.global-search input');})()");
  const bounds = async () => {
    assert.equal(await evaluate("(() => { const r=document.querySelector('.tour-panel').getBoundingClientRect();return r.left>=0 && r.top>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1 && document.documentElement.scrollWidth<=innerWidth; })()"), true, 'Tour panel stays in the viewport');
    assert.equal(await evaluate("(() => {const el=document.querySelector('.tour-actions .primary-button');const r=el.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight;})()"), true, 'Next/finish stays visible');
  };
  const replay = async () => {
    await ready();
    if (await evaluate("innerWidth <= 760 && !document.querySelector('.sidebar.open')")) await click('[data-tour="mobile-navigation"]');
    await click('[data-tour="about"]');
    await waitFor("document.querySelector('.help-modal[open] .replay-tour-button')");
    await click('.replay-tour-button');
    await welcome();
    assert.equal(await evaluate("localStorage.getItem('atlas-tour-v1') === null && !document.cookie.includes('atlas-tour-v1=done')"), true, 'Replay clears both saved markers');
  };
  await welcome();
  assert.equal(await evaluate("document.activeElement === document.querySelector('.tour-actions .primary-button')"), true);
  await bounds();
  await screenshot('tour-welcome');
  await key('Tab');
  assert.equal(await evaluate("Boolean(document.activeElement.closest('.tour-dialog'))"), true, 'Tab focus stays inside the welcome dialog');
  await click('.tour-actions .secondary-button');
  await done();
  await cdp('Page.reload');
  await waitFor("document.querySelector('.workspace-status') && document.querySelector('.profile-button')");
  await delay(300);
  assert.equal(await evaluate("document.querySelector('.tour-dialog') === null"), true, 'Declined tour does not appear on reload');
  await replay();
  await key('Enter');
  await step(0);
  await bounds();
  await screenshot('tour-search');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
  await waitFor("(() => {const a=document.querySelector('.tour-highlight').getBoundingClientRect(),b=document.querySelector('[data-tour=\"search\"]').getBoundingClientRect();return Math.abs(a.left-Math.max(6,b.left-5))<1 && a.width>=b.width;})()");
  await bounds();
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await key('Tab', 'Tab', 8);
  assert.equal(await evaluate("document.activeElement === document.querySelector('.tour-actions .secondary-button')"), true, 'Shift+Tab reaches Skip');
  await key('Tab');
  await key('Enter');
  await step(1);
  await key('Enter');
  await step(2);
  await evaluate("document.querySelector('[data-tour=\"map-type\"]').removeAttribute('data-tour')");
  await key('Enter');
  await step(4);
  await bounds();
  const roles = await evaluate("[...document.querySelectorAll('.layer-row')].map(el=>el.getAttribute('aria-checked'))");
  const target = await evaluate("(() => {const r=document.querySelector('.layer-row').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...target });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...target });
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.layer-row')].map(el=>el.getAttribute('aria-checked'))"), roles, 'Highlighted controls cannot mutate map settings during the tour');
  await evaluate("document.querySelector('.map-type-picker').setAttribute('data-tour','map-type')");
  await click('.tour-actions .primary-button');
  await step(5);
  await screenshot('tour-timeline');
  await click('.tour-actions .primary-button'); await step(6);
  await click('.tour-actions .primary-button'); await step(7);
  assert.equal(await evaluate("document.querySelector('.tour-actions .primary-button').textContent.includes('Open map')"), true);
  await click('.tour-actions .secondary-button');
  await done();
  await cdp('Page.reload');
  await waitFor("document.querySelector('[data-tour=\"about\"]')");
  await delay(300);
  assert.equal(await evaluate("document.querySelector('.tour-dialog') === null"), true, 'Completed tour does not appear on reload');
  await replay();
  await key('Escape'); await done();
  await replay();
  await click('.tour-actions .primary-button'); await step(0);
  await evaluate("window.tourTargets=[...document.querySelectorAll('[data-tour]')].map(el=>[el,el.getAttribute('data-tour')]);for(const [el] of window.tourTargets)el.removeAttribute('data-tour');window.dispatchEvent(new Event('resize'))");
  await done();
  await evaluate("for(const [el,value] of window.tourTargets)el.setAttribute('data-tour',value);delete window.tourTargets");
  await evaluate("localStorage.removeItem('atlas-tour-v1')");
  await evaluate("Storage.prototype.setItem = function(){throw new DOMException('Blocked','SecurityError')};Storage.prototype.getItem = function(){throw new DOMException('Blocked','SecurityError')};Storage.prototype.removeItem = function(){throw new DOMException('Blocked','SecurityError')}");
  await click('[data-tour="about"]'); await waitFor("document.querySelector('.replay-tour-button')"); await click('.replay-tour-button'); await welcome();
  await click('.tour-actions .secondary-button');
  await waitFor("!document.querySelector('.tour-dialog') && document.cookie.includes('atlas-tour-v1=done')");
  await cdp('Page.reload');
  await waitFor("document.querySelector('[data-tour=\"about\"]')");
  await delay(300);
  assert.equal(await evaluate("document.querySelector('.tour-dialog') === null"), true, 'Cookie fallback survives unavailable localStorage');
  assert.equal(await evaluate("localStorage.getItem('atlas-tour-v1')"), null);
  await ready();
  await click('[data-testid="language-switcher"]');
  await waitFor("document.documentElement.lang === 'fa'");
  for (const [width,height] of [[320,640],[390,844],[844,390]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3')");
    await replay();
    assert.equal(await evaluate("document.querySelector('.tour-panel h2').textContent === 'به اطلس خوش آمدید'"), true);
    await bounds();
    await click('.tour-actions .primary-button');
    for (const index of [0,1,2,3,4,5,6]) {
      await step(index);
      await bounds();
      if (index === 2) await screenshot(`tour-fa-${width}`);
      if (index === 1 && width < 760) assert.ok(await evaluate("document.querySelector('.tour-highlight').getBoundingClientRect().width < 60"), 'Mobile navigation highlights the visible menu button');
      await click('.tour-actions .primary-button');
    }
    await step(7); await click('.tour-actions .secondary-button');
    await done();
  }
  assert.deepEqual(exceptions, []);
  console.log('PASS: welcome, decline/skip/finish persistence, replay reset, cookie fallback, keyboard focus/Escape, missing targets, safe highlights, viewport positioning, Persian and mobile portrait/landscape.');
  await cdp('Browser.close');
} catch (error) {
  console.error('Tour browser diagnostics:', await diagnostics?.().catch(() => null));
  throw error;
} finally {
  socket?.close();
  chrome.kill();
}
