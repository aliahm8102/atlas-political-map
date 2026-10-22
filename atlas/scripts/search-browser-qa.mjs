import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const origin = process.env.ATLAS_TEST_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname), "Use the local demo server");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-search-"));
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
  const key = async (key, code = key, modifiers = 0) => { const windowsVirtualKeyCode = ({ Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, k: 75 })[key]; await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers, windowsVirtualKeyCode, ...(key === "Enter" ? { text: "\r" } : {}) }); await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode }); };
  const select = (selector, value) => evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); el.value=${JSON.stringify(value)}; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  const screenshot = async name => { await fs.mkdir("outputs", { recursive: true }); const shot = await cdp("Page.captureScreenshot", { format: "png" }); await fs.writeFile(`outputs/${name}.png`, Buffer.from(shot.data, "base64")); };
  diagnostics = async () => { await screenshot("search-failure"); return evaluate("({url:location.pathname+location.search,heading:document.querySelector('h1')?.textContent,body:document.body.innerText.slice(-800)})"); };
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
  console.log('PASS: local sign-in and search route protection.');
  const input = '.global-search input';
  const ready = () => waitFor("(() => {window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true}));return document.activeElement === document.querySelector('.global-search input');})()");
  await ready();
  const submit = async query => { await type(input, query); await key("Enter"); await waitFor("location.pathname === '/workspace/search' && document.querySelector('.atlas-search-results')"); };
  assert.equal(await evaluate("(() => {const r=document.querySelector('.global-search').getBoundingClientRect();const h=document.querySelector('.topbar').getBoundingClientRect();return r.width>350 && Math.abs(r.x+r.width/2-h.x-h.width/2)<2;})()"), true, 'Desktop search is wide and centered');
  const mapBefore = await evaluate("document.querySelectorAll('.map-pin').length");
  await type(input, "Iran");
  await waitFor("document.querySelector('.search-autocomplete [role=option]')?.textContent.includes('Iran')");
  assert.equal(await evaluate("document.querySelectorAll('.map-pin').length"), mapBefore, 'Typing global search does not silently filter the map');
  await key("ArrowDown");
  assert.ok(await evaluate("document.querySelector('.global-search input').getAttribute('aria-activedescendant')"));
  await key("Escape");
  assert.equal(await evaluate("document.querySelector('.global-search input').getAttribute('aria-expanded')"), "false");
  assert.equal(await evaluate("document.querySelector('.global-search input').value"), "Iran");
  await key("ArrowDown"); await key("Enter");
  await waitFor("document.querySelector('.country-heading h2')?.textContent === 'Iran'");
  await submit("presidents Iran 2024");
  await waitFor("document.querySelector('.search-result-grid')?.textContent.includes('Masoud Pezeshkian')");
  assert.equal(await evaluate("document.querySelector('.global-search input').value"), "presidents Iran 2024");
  await submit("barak obma");
  await waitFor("document.querySelector('.search-result-card h3')?.textContent === 'Barack Obama'");
  await click('.search-result-card button');
  await waitFor("location.pathname === '/workspace' && document.querySelector('.person-spotlight h3')?.textContent === 'Barack Obama'");
  assert.ok(await evaluate("Number(document.querySelector('.timeline-slider input').value) < 2017 * 12"), 'Historical selection aligns the map date');
  await evaluate("history.back()");
  await waitFor("location.pathname === '/workspace/search' && document.querySelector('.search-result-card h3')?.textContent === 'Barack Obama'");
  assert.equal(await evaluate("document.querySelector('.global-search input').value"), "barak obma");
  await submit("");
  await waitFor("document.activeElement?.id === 'atlas-search-heading'");
  assert.equal(await evaluate("document.querySelectorAll('.search-result-card').length"), 24);
  await click('.search-load-more');
  await waitFor("document.querySelectorAll('.search-result-card').length === 48");
  await evaluate("document.querySelector('.search-filters label:nth-child(5) select').focus()");
  await select('.search-filters label:nth-child(5) select', "name");
  assert.equal(await evaluate("document.activeElement === document.querySelector('.search-filters label:nth-child(5) select')"), true, 'Changing a filter preserves keyboard focus');
  assert.equal(await evaluate("document.querySelectorAll('.search-result-card').length"), 24, 'Changing filters resets pagination');
  await submit("Iran");
  await select('.search-filters label:nth-child(2) select', "Europe");
  await waitFor("Boolean(document.querySelector('.search-empty-state'))");
  assert.ok(await evaluate("document.querySelector('.search-empty-state .primary-button')?.textContent.includes('without filters')"));
  await click('.search-empty-state .primary-button');
  await waitFor("Boolean(document.querySelector('.search-result-card'))");
  assert.equal(await evaluate("document.querySelector('.global-search input').value"), "Iran");
  await select('.search-filters label:first-child select', "person");
  await select('.search-filters label:nth-child(3) select', "army");
  await select('.search-filters label:nth-child(4) select', "2024");
  await select('.search-filters label:nth-child(5) select', "name");
  const savedUrl = await evaluate("location.pathname+location.search");
  const savedNames = await evaluate("[...document.querySelectorAll('.search-result-card h3')].map(el=>el.textContent)");
  assert.ok(savedNames.length > 0);
  assert.deepEqual(savedNames, [...savedNames].sort((a,b)=>a.localeCompare(b,"en")));
  await cdp("Page.reload");
  await waitFor("Boolean(document.querySelector('.search-result-card'))");
  await ready();
  assert.equal(await evaluate("location.pathname+location.search"), savedUrl);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.search-result-card h3')].map(el=>el.textContent)"), savedNames);
  assert.equal(await evaluate("document.querySelector('.search-filters label:nth-child(4) select').value"), "2024");
  await screenshot("search-desktop");
  await click('.search-summary .secondary-button');
  await submit("obamaxxx");
  await waitFor("Boolean(document.querySelector('.search-alternatives button'))");
  assert.ok(await evaluate("document.querySelector('.search-alternatives').textContent.includes('Barack Obama')"));
  await click('.search-alternatives button');
  await waitFor("document.querySelector('.search-result-grid')?.textContent.includes('Barack Obama')");
  await submit("zzzzzzzzzzzzzzzzzz");
  await waitFor("Boolean(document.querySelector('.search-empty-state'))");
  assert.ok(await evaluate("document.querySelectorAll('.search-examples button').length >= 3"));
  await screenshot("search-empty");
  await key("k", "KeyK", 2);
  assert.equal(await evaluate("document.activeElement === document.querySelector('.global-search input')"), true, 'Ctrl+K focuses search');
  await click('[data-testid="language-switcher"]');
  await waitFor("document.documentElement.lang === 'fa'");
  await type(input, "پزشكيان");
  await waitFor("document.querySelector('.search-autocomplete')?.textContent.includes('مسعود پزشکیان')");
  await key("Enter");
  await waitFor("document.querySelector('.search-result-card h3')?.textContent === 'مسعود پزشکیان'");
  await select('.search-filters label:first-child select', "place");
  await submit("امریکا");
  await waitFor("Boolean(document.querySelector('.search-result-card'))");
  assert.ok(await evaluate("document.querySelector('.search-result-grid').textContent.includes('ایالات متحده')"));
  for (const [width, height] of [[320, 640], [390, 844], [844, 390]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3')");
    await evaluate("document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Search/results fit mobile at 130% font size');
    assert.equal(await evaluate("(() => {const r=document.querySelector('.global-search').getBoundingClientRect();const h=document.querySelector('.topbar').getBoundingClientRect();return r.width>=h.width-40 && r.left>=0 && r.right<=innerWidth;})()"), true, 'Mobile search has a wide dedicated row');
    await type(input, "ایران");
    await waitFor("document.querySelector('.search-autocomplete')?.textContent.includes('ایران')");
    assert.equal(await evaluate("(() => {const r=document.querySelector('.search-autocomplete').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth;})()"), true);
    await key("ArrowUp");
    await waitFor("(() => {const input=document.querySelector('.global-search input');const option=document.getElementById(input.getAttribute('aria-activedescendant'));if(!option) return false;const r=option.getBoundingClientRect(),box=document.querySelector('.search-autocomplete').getBoundingClientRect();return r.top>=box.top && r.bottom<=box.bottom;})()");
    await screenshot(`search-fa-mobile-${width}`);
    await key("Escape");
  }
  assert.deepEqual(exceptions, []);
  console.log("Search browser checks passed: protected routes, keyboard suggestions, people/places, typo and intent matching, historical map focus, filters/sorting, reload/back restoration, zero-result alternatives, Persian and mobile layouts.");
  await cdp("Browser.close");
} catch (error) {
  console.error("Search browser diagnostics:", await diagnostics?.().catch(() => null));
  throw error;
} finally {
  socket?.close();
  chrome.kill();
}
