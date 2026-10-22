import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-browser-"));
await fs.mkdir("outputs", { recursive: true });
const chrome = spawn(process.env.ATLAS_CHROME_BIN || "/usr/bin/google-chrome", ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking", "--disable-component-update", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
let fixtureServer;
let debugPage;
let captureFailure;
let socket; let seq = 0; const pending = new Map(); const exceptions = []; const backendRequests = [];
try {
  let portInfo;
  for (let i = 0; i < 100; i++) { try { portInfo = (await fs.readFile(path.join(profile, "DevToolsActivePort"), "utf8")).trim().split("\n"); break; } catch { await delay(100); } }
  if (!portInfo) throw new Error("Chrome did not start");
  socket = new WebSocket(`ws://127.0.0.1:${portInfo[0]}${portInfo[1]}`);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", event => {
    const data = JSON.parse(String(event.data));
    if (data.id) {
      const promise = pending.get(data.id);
      if (promise) {
        pending.delete(data.id);
        if (data.error) promise.reject(new Error(data.error.message));
        else promise.resolve(data.result);
      }
    }
    if (data.method === "Runtime.exceptionThrown") exceptions.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
    if (data.method === "Network.requestWillBeSent" && /supabase\.co\/(auth|rest)\/v1\//.test(data.params.request.url)) backendRequests.push(data.params.request.url);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 30000);
    pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const target = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  const cdp = (method, params = {}) => send(method, params, sessionId);
  await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Network.enable");
  const navigate = async url => {
    let listener; let timeout;
    const ready = new Promise((resolve, reject) => {
      listener = event => { const data = JSON.parse(String(event.data)); if (data.method === "Page.domContentEventFired" && data.sessionId === sessionId) resolve(); };
      socket.addEventListener("message", listener);
      timeout = setTimeout(() => reject(new Error(`Navigation timed out: ${url}`)), 30000);
    });
    try { await Promise.all([cdp("Page.navigate", { url }), ready]); }
    finally { clearTimeout(timeout); socket.removeEventListener("message", listener); }
  };
  const evaluate = async expression => { const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  debugPage = () => evaluate("({path: location.pathname, error: document.querySelector('.form-error')?.textContent, heading: document.querySelector('h1,h2')?.textContent, body: document.body.innerText.slice(0, 1200)})");
  const waitFor = async (expression, label = expression) => { for (let i = 0; i < 150; i++) { try { if (await evaluate(`Boolean(${expression})`)) return; } catch (error) { if (!/navigated|context.*destroyed|Cannot find context/i.test(error.message)) throw error; } await delay(100); } throw new Error(`Timed out: ${label}`); };
  const click = selector => evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) throw new Error('Missing element: ' + ${JSON.stringify(selector)}); element.click(); return true; })()`);
  const nav = label => evaluate(`(() => { const el = [...document.querySelectorAll('nav button')].find(b => b.textContent.includes(${JSON.stringify(label)})); if (!el) throw new Error('Missing navigation'); el.click(); })()`);
  const input = (selector, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing input'); const setter = Object.getOwnPropertyDescriptor(${selector.includes("textarea") ? "HTMLTextAreaElement" : "HTMLInputElement"}.prototype, 'value').set; setter.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  const screenshot = async name => { const result = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await fs.writeFile(`outputs/${name}.png`, Buffer.from(result.data, "base64")); };
  captureFailure = () => screenshot('atlas-browser-failure');
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  if (process.env.ATLAS_MAP_ONLY !== "1") {
  const origin = process.env.ATLAS_TEST_ORIGIN || "http://127.0.0.1:3000";
  for (const route of ["/", "/demo", "/workspace", "/workspace/characters"]) {
    await navigate(`${origin}${route}`);
    await waitFor("location.pathname === '/login' && document.querySelector('.auth-card')", `Sign-in required for ${route}`);
    assert.equal(await evaluate("document.querySelector('.world-map') === null"), true);
    assert.equal(await evaluate("document.querySelector('a[href=\"/demo\"]') === null"), true);
  }
  await evaluate("localStorage.setItem('atlas-demo-v1', JSON.stringify({settings:{}, displayName:'Forged account', bookmarks:[],notes:{}}))");
  await navigate(`${origin}/demo`);
  await waitFor("location.pathname === '/login' && document.querySelector('.auth-card')", "Old demo storage cannot grant access");
  const authMode = await evaluate("document.querySelector('.auth-page').dataset.authMode");
  const configured = authMode === "supabase";
  // A connected project must never receive test signups or recovery emails.
  // Exercise the fields without submitting when real configuration is loaded.
  const submitWithoutBackend = async () => {
    assert.equal(await evaluate("!document.querySelector('.auth-submit').disabled"), true);
    if (configured) return;
    await click('.auth-submit');
    await waitFor("document.querySelector('.form-error')?.textContent.includes('Account access is not enabled')", "Missing auth service produces a useful error");
  };
  // Use browser text input, rather than setting DOM values, to catch disabled
  // fields and verify that React keeps the text entered by a real user.
  const typeInto = async (selector, value) => {
    await evaluate(`(() => { const field = document.querySelector(${JSON.stringify(selector)}); if (!field || field.disabled || field.readOnly) throw new Error('Field cannot be edited'); field.focus(); field.select(); })()`);
    await cdp("Input.insertText", { text: value });
    await waitFor(`document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(value)}`, "Typed text is retained");
  };
  await waitFor("(() => { if (document.querySelector('button[aria-label=\"Hide password\"]')) return true; document.querySelector('button[aria-label=\"Show password\"]')?.click(); return false; })()", "Auth form is interactive");
  await click('button[aria-label="Hide password"]');
  if (authMode === "local") {
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname), "Local credentials may only be tested on loopback");
    const credentials = Object.fromEntries((await fs.readFile('.env.demo.local', 'utf8')).split('\n').filter(line => line && !line.startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
    assert.equal(await evaluate("!document.querySelector('.auth-switch') && !document.querySelector('.forgot')"), true);
    await typeInto('input[autocomplete="email"]', credentials.ATLAS_DEMO_EMAIL);
    await typeInto('input[autocomplete="current-password"]', 'Incorrect-password-42');
    await click('.auth-submit');
    await waitFor("document.querySelector('.form-error')?.textContent.includes('Incorrect email or password')", "Wrong local password is rejected");
    assert.equal(await evaluate("location.pathname === '/login' && !document.querySelector('.world-map')"), true);
    const signIn = async () => {
      await typeInto('input[autocomplete="email"]', credentials.ATLAS_DEMO_EMAIL);
      await typeInto('input[autocomplete="current-password"]', credentials.ATLAS_DEMO_PASSWORD);
      await click('.auth-submit');
      await waitFor("location.pathname === '/workspace' && document.querySelector('.world-map')", "Local account opens the map");
      assert.equal(await evaluate("document.querySelector('.sidebar-personal-card, .map-coordinate, .map-legend, .explore-tip, .snapshot-badge') === null"), true, 'Workspace removes the promotional sidebar card, map captions, tip and snapshot badge');
      await screenshot('atlas-sidebar-clean');
      await waitFor("(() => { document.querySelector('button[aria-label=\"Open profile and preferences\"]')?.click(); return Boolean(document.querySelector('#display-name')); })()", "Workspace is interactive");
    };
    await signIn();
    assert.equal(await evaluate("document.querySelector('.settings-summary') === null && document.querySelectorAll('.settings-grid > .settings-card').length === 2"), true, 'My workspace keeps profile and appearance without the summary card');
    await nav('Explore map');
    await waitFor("document.querySelector('.map-type-trigger')");
    await click('.map-type-trigger');
    await waitFor("document.querySelector('.map-type-options')");
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-map-type]')].map(el=>el.dataset.mapType)"), ['default', 'terrain', 'natural']);
    assert.equal(await evaluate("[...document.querySelectorAll('[data-map-type]')].every(el=>el.disabled)"), true, 'Map types are a visual preview without switching map rendering');
    await screenshot('atlas-map-types');
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await waitFor("!document.querySelector('.map-type-options') && document.activeElement === document.querySelector('.map-type-trigger')");
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await waitFor("document.querySelector('.map-type-options')");
    await evaluate("document.querySelector('.topbar').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
    await waitFor("!document.querySelector('.map-type-options')");
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 700, deviceScaleFactor: 1, mobile: false });
    await evaluate("window.scrollTo(0,300)");
    await waitFor("scrollY > 100 && Math.abs(document.querySelector('.topbar').getBoundingClientRect().top) < 1");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.topbar')).position"), 'sticky');
    await evaluate("window.scrollTo(0,0)");
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
    console.log('PASS: simplified map/workspace, keyboard and outside dismissal of map type preview, and sticky header while scrolling.');
    for (const attempt of ['first visit', 'return visit']) {
      await nav('Explore map');
      await waitFor("document.querySelector('.world-map') && location.pathname === '/workspace'");
      assert.equal(await evaluate("document.querySelector('.inspector [role=tablist],.inspector [role=tab],.inspector .appearance-controls') === null && document.querySelectorAll('.inspector .layer-row').length === 5"), true, 'Map controls show layers directly without appearance or tabs');
      await click('nav a[href="/workspace/characters"]');
      await waitFor("location.pathname === '/workspace/characters' && document.querySelector('.character-form button[type=submit]:not(:disabled)')", `My characters opens on one click: ${attempt}`);
    }
    await navigate(`${origin}/workspace/characters`);
    await waitFor("document.querySelector('.character-form button[type=submit]:not(:disabled)')", 'Direct character route is ready');
    await nav('Explore map');
    await waitFor("document.querySelector('.world-map')");
    await click('nav a[href="/workspace/characters"]');
    await waitFor("location.pathname === '/workspace/characters' && document.querySelector('.character-form')", 'My characters reopens on one click after a direct load');
    await nav('My workspace');
    await click('.page-heading .add-character-button');
    await waitFor("location.pathname === '/workspace/characters' && document.querySelector('.character-form')", 'Add character reopens the cached character route on one click');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await nav('Explore map');
    await click('button[aria-label="Open navigation"]');
    await waitFor("document.querySelector('.sidebar.open')");
    await delay(250);
    await click('nav a[href="/workspace/characters"]');
    await waitFor("document.querySelector('.character-form') && !document.querySelector('.sidebar.open')", 'Mobile My characters opens on one click and closes the drawer');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
    await nav('My workspace');
    console.log('PASS: one-click My characters navigation on first/return visits, direct loads, cached Add character links, and mobile drawer closure.');
    const { cookies } = await cdp("Network.getCookies", { urls: [origin] });
    const sessionCookie = cookies.find(cookie => cookie.name === 'atlas-local-session');
    assert.ok(sessionCookie?.httpOnly && sessionCookie.sameSite === 'Strict');
    assert.equal(await evaluate("document.cookie.includes('atlas-local-session')"), false);
    await typeInto('#display-name', 'Local Test Explorer');
    await click('form:has(#display-name) button');
    await waitFor("document.querySelector('.profile-button strong')?.textContent === 'Local Test Explorer'", "Local profile saves");
    assert.equal(await evaluate("document.querySelectorAll('.theme-choice').length"), 4, 'Four color themes are available');
    assert.equal(await evaluate("document.querySelectorAll('.accent-choice').length"), 5, 'Five accent colors are available');
    const defaultFont = await evaluate("parseFloat(getComputedStyle(document.querySelector('.settings-card h2')).fontSize)");
    for (const theme of ['light', 'dark', 'sand', 'midnight']) {
      await click(`.theme-choice.${theme}`);
      await waitFor(`document.querySelector('.atlas-app').dataset.theme === '${theme}'`);
      let previousAccent;
      for (const accent of ['sage', 'blue', 'lavender', 'amber', 'rose']) {
        await click(`.accent-choice.${accent}`);
        await waitFor(`document.querySelector('.atlas-app').dataset.accent === '${accent}'`);
        const color = await evaluate("getComputedStyle(document.querySelector('.atlas-app')).getPropertyValue('--accent').trim()");
        assert.notEqual(color, previousAccent, `${theme}/${accent} applies its palette`);
        previousAccent = color;
      }
    }
    await evaluate("document.querySelector('.font-size-control input').focus()");
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    await waitFor("document.querySelector('.font-size-control input').value === '130'", 'Keyboard sets maximum font size');
    const largeFont = await evaluate("parseFloat(getComputedStyle(document.querySelector('.settings-card h2')).fontSize)");
    assert.ok(Math.abs(largeFont / defaultFont - 1.3) < .01, 'Text scales to 130%');
    await screenshot('atlas-workspace-midnight');
    await click('.theme-choice.sand');
    await click('.accent-choice.amber');
    await screenshot('atlas-workspace-sand');
    await navigate(`${origin}/workspace`);
    await waitFor("document.querySelector('.atlas-app')?.dataset.theme === 'sand' && document.querySelector('.atlas-app')?.dataset.accent === 'amber'", 'New theme and accent persist after reload');
    assert.equal(await evaluate("document.querySelector('.atlas-app').style.getPropertyValue('--font-scale')"), '1.3', 'Font size persists after reload');
    assert.equal(await evaluate("document.querySelector('.page-heading .add-character-button') === null"), true, 'Add character is removed from the main page');
    await nav('My workspace');
    await waitFor("document.querySelector('.font-size-control input')?.value === '130'", 'Workspace restores the saved font size');
    assert.equal(await evaluate("document.querySelector('.page-heading .add-character-button').getAttribute('href')"), '/workspace/characters');
    for (const width of [320, 390]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `Workspace fits ${width}px at 130% font size`);
    }
    const mobileLargeFont = await evaluate("parseFloat(getComputedStyle(document.querySelector('.settings-card h2')).fontSize)");
    await evaluate("document.querySelector('.font-size-control input').focus()");
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 });
    await waitFor("document.querySelector('.font-size-control input').value === '90'", 'Keyboard sets minimum font size');
    const mobileSmallFont = await evaluate("parseFloat(getComputedStyle(document.querySelector('.settings-card h2')).fontSize)");
    assert.ok(Math.abs(mobileLargeFont / mobileSmallFont - 130 / 90) < .01, 'Mobile text scales with the same font preference');
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    await waitFor("document.querySelector('.font-size-control input').value === '130'");
    await evaluate("document.querySelector('.appearance-controls').scrollIntoView({block:'start'})");
    await screenshot('atlas-workspace-mobile');
    await click('[data-testid="language-switcher"]');
    await waitFor("document.documentElement.lang === 'fa' && document.querySelector('.font-size-control label').textContent.includes('\u0641\u0648\u0646\u062a')", 'Font size control is translated into Persian');
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Persian workspace fits mobile at 130% font size');
    assert.match(await evaluate("document.querySelector('.font-size-control output').textContent"), /[\u06f0-\u06f9]/);
    await delay(300);
    assert.equal(await evaluate("(() => { const labels = [...document.querySelectorAll('.accent-choice > span')].map(el => el.getBoundingClientRect()); const card = document.querySelector('.appearance-controls').closest('.settings-card').getBoundingClientRect(); return labels.every((rect, i) => rect.left >= card.left && rect.right <= card.right && labels.every((other, j) => i === j || rect.right <= other.left || rect.left >= other.right || rect.bottom <= other.top || rect.top >= other.bottom)); })()"), true, 'Persian accent labels fit without clipping or overlapping');
    await screenshot('atlas-workspace-fa-mobile');
    await click('[data-testid="language-switcher"]');
    await waitFor("document.documentElement.lang === 'en'");
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
    await click('.appearance-controls > .secondary-button');
    await waitFor("document.querySelector('.font-size-control input').value === '100' && document.querySelector('.atlas-app').dataset.theme === 'light' && document.querySelector('.atlas-app').dataset.accent === 'sage'", 'Reset appearance restores all appearance defaults');
    await click('.page-heading .add-character-button');
    await waitFor("location.pathname === '/workspace/characters' && document.querySelector('.character-form')", 'Add character opens its editor from My workspace');
    console.log('PASS: four themes, five accents, keyboard font scaling, saved appearance after reload, mobile/Persian layout, reset appearance, and Add character moved to My workspace.');
    await nav('People directory');
    await waitFor("document.querySelector('.person-card')");
    await click('.person-card-top button');
    await waitFor("document.querySelector('.person-card-top .is-bookmarked')", "Local bookmark saves");
    await click('.person-card-bottom button');
    await waitFor("document.querySelector('.person-spotlight')");
    assert.equal(await evaluate("document.querySelector('#country-note,.country-note') === null"), true, "Private note is removed from the inspector");
    await navigate(`${origin}/workspace`);
    await waitFor("document.querySelector('.profile-button strong')?.textContent === 'Local Test Explorer'", "Local profile survives reload");
    await nav('Bookmarks');
    await waitFor("document.querySelector('.person-card')", "Local bookmark survives reload");
    await click('.person-card-bottom button');
    await waitFor("document.querySelector('.person-spotlight')", "Bookmarked person details reopen after reload");
    await click('a[href="/workspace/characters"]');
    await waitFor("location.pathname === '/workspace/characters' && document.querySelector('.character-form button[type=submit]:not(:disabled)')", 'Authenticated character page opens through navigation');
    assert.equal(await evaluate("!document.querySelector('.save-view-button,.saved-section') && ![...document.querySelectorAll('nav a,nav button')].some(item => item.textContent.includes('Saved views'))"), true, 'Retired views UI is removed');
    await typeInto('[name="character-name"]', 'شخصیت آزمایشی');
    await typeInto('[name="character-title"]', 'توضیح شخصی');
    await click('.character-form button[type="submit"]');
    await waitFor("document.querySelector('.custom-character h3')?.textContent === 'شخصیت آزمایشی'", 'Character is saved from the complete workspace');
    await click('.custom-character .text-link');
    await waitFor("location.pathname === '/workspace' && document.querySelector('.person-spotlight h3')?.textContent === 'شخصیت آزمایشی'", 'Custom character opens on the map');
    await click('.bookmark-person');
    await waitFor("document.querySelector('.bookmark-person.is-bookmarked')", 'Custom character bookmark saves locally');
    await nav('Bookmarks');
    await waitFor("[...document.querySelectorAll('.person-card h3')].some(item => item.textContent === 'شخصیت آزمایشی')", 'Custom character participates in bookmarks');
    await navigate(`${origin}/workspace/characters`);
    await waitFor("document.querySelector('.custom-character h3')?.textContent === 'شخصیت آزمایشی'", 'Direct character route restores local data after navigation');
    await screenshot('atlas-characters-workspace');
    await click('.custom-character .icon-button');
    await waitFor("!document.querySelector('.custom-character')", 'Character deletion removes its local record and bookmark');
    await nav('My workspace');
    await click('.account-info button');
    await waitFor("location.pathname === '/login' && document.querySelector('.auth-card')", "Local sign-out returns to login");
    await navigate(`${origin}/workspace`);
    await waitFor("location.pathname === '/login'", "Signing out locks the map again");
    await cdp('Network.setCookie', { name: 'atlas-local-session', value: 'forged-session', url: origin, httpOnly: true, sameSite: 'Strict' });
    await navigate(`${origin}/workspace`);
    await waitFor("location.pathname === '/login' && document.querySelector('.auth-card')", "A forged local cookie cannot open the map");
    await waitFor("(() => { if (document.querySelector('button[aria-label=\"Hide password\"]')) return true; document.querySelector('button[aria-label=\"Show password\"]')?.click(); return false; })()", "Auth form is interactive");
    await signIn();
    await waitFor("document.querySelector('.profile-button strong')?.textContent === 'Local Test Explorer'", "Local account state survives signing out and back in");
    assert.deepEqual(backendRequests, [], 'Local sign-in and storage must not contact Supabase');
    await nav('Explore map');
    await screenshot('atlas-local-account');
    assert.deepEqual(exceptions, [], 'Local account raised browser exceptions');
    console.log('PASS: local wrong-password rejection, signed HttpOnly session, authenticated map access, profile/bookmark persistence across reload, sign-out, forged-cookie rejection, re-login, and no Supabase requests.');
    // Changing language must preserve the current view, session, and account data.
    await click('button[aria-label="Zoom in"]');
    await waitFor("document.querySelector('.map-scale').textContent.includes('1.4')");
    await evaluate("(() => { const select = document.querySelector('.region-filter select'); select.value = 'Asia'; select.dispatchEvent(new Event('change', {bubbles:true})); })()");
    const mapTransform = await evaluate("document.querySelector('.world-map > g').getAttribute('transform')");
    await click('[data-testid="language-switcher"]');
    await waitFor("document.documentElement.lang === 'fa' && document.documentElement.dir === 'rtl' && document.querySelector('.page-heading h1').textContent.includes('دیدگاه‌ها')", 'Persian translations and RTL activate');
    assert.equal(await evaluate("document.querySelector('.world-map > g').getAttribute('transform')"), mapTransform, 'Switching languages reset the map');
    assert.equal(await evaluate("document.querySelector('.region-filter select').value"), 'Asia');
    assert.equal(await evaluate("document.querySelector('.region-filter option:checked').textContent"), 'آسیا');
    const sidebarPlacement = await evaluate("(() => { const el = document.querySelector('.sidebar'); const r = el.getBoundingClientRect(); return {right:r.right, left:r.left, viewport:innerWidth, client:document.documentElement.clientWidth, inlineStart:getComputedStyle(el).insetInlineStart, inlineEnd:getComputedStyle(el).insetInlineEnd, direction:getComputedStyle(el).direction}; })()");
    assert.ok(Math.min(Math.abs(sidebarPlacement.right - sidebarPlacement.viewport), Math.abs(sidebarPlacement.right - sidebarPlacement.client)) < 2, `Persian sidebar is not on the right: ${JSON.stringify(sidebarPlacement)}`);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Persian desktop has horizontal overflow');
    assert.match(await evaluate("document.querySelector('.map-scale').textContent"), /۱/);
    assert.match(await evaluate("document.querySelector('.timeline-date strong').textContent"), /۲۰۲۶/);
    assert.equal(await evaluate("document.fonts.check('16px Vazirmatn')"), true, 'Bundled Persian font did not load');
    await screenshot('atlas-fa-desktop');
    await click('button[aria-label="نمایش تمام‌صفحه"]');
    await waitFor("document.fullscreenElement === document.querySelector('.map-experience')", 'Persian map fullscreen works');
    await click('button[aria-label="خروج از تمام‌صفحه"]');
    await waitFor("!document.fullscreenElement");
    await typeInto('.topbar-search input', 'ایران');
    await waitFor("document.querySelector('.search-results')?.textContent.includes('ایران')", 'Persian country search finds Iran');
    await click('.search-results button');
    await waitFor("document.querySelector('.country-heading h2')?.textContent === 'ایران'", 'Persian country details render');
    assert.match(await evaluate("document.querySelector('.person-spotlight h3').textContent"), /[\u0600-\u06ff]/);
    await nav('فهرست افراد');
    await typeInto('.topbar-search input', 'پزشكيان');
    await click('.search-submit');
    await waitFor("document.querySelector('.search-result-card h3')?.textContent === 'مسعود پزشکیان'", 'Persian search normalizes Arabic letters');
    assert.equal(await evaluate("document.querySelector('.search-result-card p').textContent"), 'رئیس‌جمهور ایران');
    await typeInto('.topbar-search input', 'Masoud');
    await click('.search-submit');
    await waitFor("document.querySelector('.search-result-card h3')?.textContent === 'مسعود پزشکیان'", 'English aliases still work in Persian');
    await click('button[aria-label="پاک‌کردن جست‌وجو"]');
    await nav('فضای من');
    await waitFor("document.querySelector('.settings-card h2')?.textContent === 'پروفایل شما'");
    await click('.help-button');
    await waitFor("document.querySelector('dialog[open] h2')?.textContent.includes('آگاهی')", 'Persian help dialog is translated');
    await click('button[aria-label="بستن پنجره"]');
    await nav('کاوش نقشه');
    for (const width of [320, 390]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
      await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3'); document.querySelector('.map-type-trigger').scrollIntoView({block:'center'})");
      await click('.map-type-trigger');
      await waitFor("document.querySelector('.map-type-options')");
      assert.equal(await evaluate("document.querySelector('.map-type-trigger').textContent.includes('انتخاب نوع نقشه') && document.querySelector('.map-type-options').textContent.includes('به‌زودی')"), true);
      assert.equal(await evaluate("(() => {const r=document.querySelector('.map-type-options').getBoundingClientRect(), card=document.querySelector('.map-card').getBoundingClientRect();return r.left>=card.left && r.right<=card.right && r.bottom<=card.bottom && document.documentElement.scrollWidth<=innerWidth;})()"), true, 'Persian map type preview fits the card at 130% font size');
      await screenshot(`atlas-map-types-fa-${width}`);
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await evaluate("window.scrollTo(0,500)");
      await waitFor("scrollY > 100 && Math.abs(document.querySelector('.topbar').getBoundingClientRect().top) < 1");
    }
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1');window.scrollTo(0,0)");
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Persian mobile has horizontal overflow');
    await click('button[aria-label="بازکردن منو"]');
    await waitFor("document.querySelector('.sidebar.open')", 'Persian mobile menu opens');
    await delay(250);
    assert.equal(await evaluate("Math.min(Math.abs(document.querySelector('.sidebar').getBoundingClientRect().right - innerWidth), Math.abs(document.querySelector('.sidebar').getBoundingClientRect().right - document.documentElement.clientWidth)) < 2"), true, 'Persian mobile drawer opens on the right');
    await nav('کاوش نقشه');
    await waitFor("!document.querySelector('.sidebar.open')", 'Persian mobile menu closes');
    await delay(250);
    await screenshot('atlas-fa-mobile');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
    await nav('فضای من');
    await click('.account-info button');
    await waitFor("location.pathname === '/login' && document.querySelector('.auth-card h2')?.textContent === 'اطلس محلی شما.'", 'Persian language persists after sign-out');
    await navigate(`${origin}/login`);
    await waitFor("document.documentElement.lang === 'fa' && document.querySelector('.auth-card h2')?.textContent === 'اطلس محلی شما.'", 'Persian is server-rendered after navigation');
    await waitFor("(() => { if (document.querySelector('button[aria-label=\"پنهان‌کردن رمز عبور\"]')) return true; document.querySelector('button[aria-label=\"نمایش رمز عبور\"]')?.click(); return false; })()", 'Persian auth form is interactive');
    await typeInto('input[autocomplete=email]', credentials.ATLAS_DEMO_EMAIL);
    await typeInto('input[autocomplete="current-password"]', 'Wrong-password-42');
    await click('.auth-submit');
    await waitFor("document.querySelector('.form-error')?.textContent.includes('نادرست')", 'Local auth errors are translated');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('input[autocomplete=email]')).direction"), 'ltr');
    await screenshot('atlas-fa-login');
    await click('[data-testid="language-switcher"]');
    await waitFor("document.documentElement.lang === 'en' && document.documentElement.dir === 'ltr' && document.querySelector('.form-error')?.textContent.includes('Incorrect email or password')", 'English restores UI and existing error messages');
    assert.equal(await evaluate("document.querySelector('input[autocomplete=email]').value"), credentials.ATLAS_DEMO_EMAIL, 'Language change cleared entered credentials');
    await navigate(`${origin}/login`);
    await waitFor("document.documentElement.lang === 'en' && document.querySelector('.auth-card h2')?.textContent === 'Your local atlas.'", 'English choice persists across navigation');
    const faPage = await fetch(`${origin}/login`, {headers:{Cookie:'atlas-locale=fa'}});
    const faHtml = await faPage.text();
    assert.match(faHtml, /<html[^>]*lang="fa"[^>]*dir="rtl"/);
    assert.match(faHtml, /اطلس محلی شما/);
    assert.deepEqual(backendRequests, [], 'Language changes must not contact Supabase');
    assert.deepEqual(exceptions, [], 'Bilingual UI raised browser exceptions');
    console.log('PASS: Persian/English switching, server locale persistence, RTL desktop/mobile drawer, Persian font/numbers/Gregorian dates, preserved filters and viewport, bilingual country/person search, localized office titles and errors, Persian fullscreen, and preserved user content.');
  } else {
  await typeInto('input[autocomplete="email"]', 'explorer@example.test');
  await typeInto('input[autocomplete="current-password"]', 'Test-password-42');
  await submitWithoutBackend();
  assert.equal(await evaluate("location.pathname === '/login' && !document.querySelector('.world-map')"), true);
  assert.equal(await evaluate("document.querySelector('input[autocomplete=email]').value"), 'explorer@example.test');
  assert.equal(await evaluate("document.querySelector('input[autocomplete=\"current-password\"]').value"), 'Test-password-42');
  await click('.auth-switch button');
  await waitFor("document.querySelector('input[autocomplete=name]')", "Signup form opens");
  await typeInto('input[autocomplete="name"]', 'Test Explorer');
  await typeInto('input[autocomplete="email"]', 'new-explorer@example.test');
  await typeInto('input[autocomplete="new-password"]', 'New-password-42');
  await submitWithoutBackend();
  await click('.auth-switch button');
  await click('.forgot');
  await waitFor("!document.querySelector('input[autocomplete=\"current-password\"]')", "Recovery form opens");
  await typeInto('input[autocomplete="email"]', 'recovery@example.test');
  await submitWithoutBackend();
  await navigate(`${origin}/auth/update-password`);
  await waitFor("document.querySelector('input[autocomplete=\"new-password\"]')", "Password update form opens");
  await waitFor("(() => { if (document.querySelector('button[aria-label=\"Hide password\"]')) return true; document.querySelector('button[aria-label=\"Show password\"]')?.click(); return false; })()", "Auth form is interactive");
  await click('button[aria-label="Hide password"]');
  await typeInto('input[autocomplete="new-password"]', 'Updated-password-42');
  await submitWithoutBackend();
  assert.equal(await evaluate("document.querySelector('.world-map') === null"), true);
  if (configured) {
    assert.equal(await evaluate("!document.querySelector('.info-notice') && !document.querySelector('.form-error')"), true);
  }
  await screenshot("atlas-auth-inputs");
  console.log(`PASS: editable email/password/name fields in sign-in, signup, recovery and password update; ${configured ? 'Supabase configuration loaded; read-only checks sent no authentication requests' : 'missing auth service cannot grant map access'}.`);
  }
  }
  if (process.env.ATLAS_AUTH_ONLY !== "1") {
  const root = fileURLToPath(new URL("../", import.meta.url));
  fixtureServer = await createServer({
    configFile: false, root,
    resolve: { alias: { "@": root } },
    server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/.next-qa/**", "**/outputs/**", "**/work/**"] } },
    optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-runtime", "@supabase/ssr", "@supabase/supabase-js", "d3-geo", "lucide-react", "topojson-client", "zod"], noDiscovery: true },
    plugins: [react(), { name: "isolated-browser-fixture", configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split("?")[0] !== "/") return next();
        try {
          const html = await server.transformIndexHtml("/", '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/browser-fixture.tsx"></script></body></html>');
          response.setHeader("Content-Type", "text/html"); response.end(html);
        } catch (error) { next(error); }
      });
    } }],
  });
  await fixtureServer.listen();
  const fixtureOrigin = fixtureServer.resolvedUrls.local[0];
  await navigate(fixtureOrigin);
  await waitFor("document.querySelectorAll('.country').length > 160 && document.querySelector('.map-pin')", "Interactive map renders");
  assert.equal(await evaluate("document.querySelector('.map-coordinate, .map-legend') === null"), true, 'Static map caption and legend are removed');
  const assertCountryHints = async (label, touch = false) => {
    await cdp('Page.bringToFront');
    await evaluate("document.querySelector('.map-stage').dispatchEvent(new KeyboardEvent('keydown', {key:'Home',bubbles:true}))");
    await evaluate("document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))");
    const selected = () => evaluate("document.querySelector('.country.selected')?.getAttribute('data-country') ?? null");
    const originalSelected = await selected();
    const findCountry = (exclude = null) => evaluate(`(() => {
      const r = document.querySelector('.map-stage').getBoundingClientRect();
      const buttons = [...document.querySelectorAll('.map-pin, .map-controls')].map(el => el.getBoundingClientRect());
      for (let y = Math.max(r.top + 30, 30); y < Math.min(r.bottom - 15, innerHeight - 15); y += 18) {
        for (let x = Math.max(r.left + 15, 15); x < Math.min(r.right - 15, innerWidth - 15); x += 18) {
          const country = document.elementFromPoint(x,y)?.closest('[data-country]');
          if (country && country.dataset.country !== ${JSON.stringify(exclude)} && !buttons.some(b => x > b.left-12 && x < b.right+12 && y > b.top-12 && y < b.bottom+12)) return {x,y,code:country.dataset.country,name:country.getAttribute('aria-label')};
        }
      }
      return null;
    })()`);
    const point = await findCountry(originalSelected);
    assert.ok(point, label + ': an unobscured country is available');
    const tooltip = () => evaluate("document.querySelector('.map-country-tooltip')?.textContent ?? null");
    const view = () => evaluate("document.querySelector('.world-map > g').getAttribute('transform')");
    const before = await view();
    if (touch) {
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
      await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{x:point.x,y:point.y,id:51}] });
      await delay(200);
      assert.equal(await tooltip(), null, 'Short contact must not trigger a country preview');
      await waitFor(`document.querySelector('.map-country-tooltip')?.textContent === ${JSON.stringify(point.name)}`, label + ': hold shows localized country name');
    } else {
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
      await waitFor(`document.querySelector('.map-country-tooltip')?.textContent === ${JSON.stringify(point.name)}`, label + ': mouse hover shows country name');
      const other = await findCountry(point.code);
      assert.ok(other);
      await cdp('Input.dispatchMouseEvent', { type:'mouseMoved', x:other.x, y:other.y });
      await waitFor(`document.querySelector('.map-country-tooltip')?.textContent === ${JSON.stringify(other.name)}`);
    }
    assert.equal(await selected(), originalSelected, 'Preview does not select a country');
    assert.equal(await view(), before, 'Preview does not move the map');
    assert.equal(await evaluate("document.querySelectorAll('.country.country-preview').length"), 1, 'Preview highlights exactly one country');
    assert.equal(await evaluate("(() => {const a=document.querySelector('.map-country-tooltip').getBoundingClientRect();const b=document.querySelector('.map-stage').getBoundingClientRect();return a.left>=b.left && a.top>=b.top && a.right<=b.right && a.bottom<=b.bottom;})()"), true, 'Country name stays inside map bounds');
    await screenshot(`atlas-country-hint-${label.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
    if (touch) {
      await cdp('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
      await waitFor("!document.querySelector('.map-country-tooltip')");
      assert.equal(await selected(), originalSelected, 'Releasing a held country must not select it');
      await cdp('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:point.x,y:point.y,id:51}] });
      await cdp('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{x:point.x+18,y:point.y+12,id:51}] });
      await delay(650);
      assert.equal(await tooltip(), null, 'Dragging cancels the hold timer');
      await cdp('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
      await evaluate("document.querySelector('.map-stage').dispatchEvent(new KeyboardEvent('keydown', {key:'Home',bubbles:true}))");
      await cdp('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:point.x,y:point.y,id:51}] });
      await cdp('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:point.x,y:point.y,id:51},{x:point.x+25,y:point.y+20,id:52}] });
      await delay(650);
      assert.equal(await tooltip(), null, 'A second finger cancels the hold timer');
      await cdp('Input.dispatchTouchEvent', { type:'touchCancel', touchPoints:[] });
      await cdp('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:point.x,y:point.y,id:51}] });
      await cdp('Input.dispatchTouchEvent', { type:'touchCancel', touchPoints:[] });
      await delay(650);
      assert.equal(await tooltip(), null, 'Cancelled pointers leave no delayed preview');
      await cdp('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:point.x,y:point.y,id:51}] });
      await cdp('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
      await waitFor(`document.querySelector('.country.selected')?.dataset.country === ${JSON.stringify(point.code)}`, 'Short taps still select countries');
      await cdp('Emulation.setTouchEmulationEnabled', {enabled:false});
    } else {
      await cdp('Input.dispatchMouseEvent', {type:'mouseMoved', x:2, y:2});
      await waitFor("!document.querySelector('.map-country-tooltip')");
    }
    assert.equal(await evaluate("document.querySelector('.country title') === null"), true, 'Native SVG tooltips cannot duplicate the custom preview');
    console.log(`PASS: ${label} country ${touch ? 'hold, release, drag/pinch/cancel handling and short tap selection' : 'hover, highlight and dismissal'}.`);
  };
  await assertCountryHints('Desktop');
  assert.equal(await evaluate("document.querySelector('button[aria-label=\"Drawing tools\"]') === null"), true, 'Drawing tools are offered only in fullscreen');
  const chooseSpeed = async speed => {
    await evaluate(`(() => { const select = document.querySelector('.timeline-speed select'); select.value = '${speed}'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(`document.querySelector('.timeline-speed span').textContent === '${speed}x'`, `Playback speed changes to ${speed}x`);
  };
  for (const speed of [0.5, 1, 1.5, 2]) {
    await click('.timeline-ticks button');
    assert.equal(await evaluate("document.querySelector('.timeline-speed') === null"), true, 'Speed control is hidden when paused');
    await click('button[aria-label="Play timeline"]');
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.timeline-speed option')].map(option => option.textContent)"), ['0.5x', '1x', '1.5x', '2x']);
    await chooseSpeed(speed);
    const elapsed = await evaluate(`new Promise((resolve, reject) => { const input = document.querySelector('.timeline-slider input'); const before = Number(input.value); let previous = before; const steps = []; const start = performance.now(); const timer = setInterval(() => { const value = Number(input.value); if (value !== previous) { steps.push(value - previous); previous = value; } if (value - before >= ${speed * 4}) { clearInterval(timer); clearTimeout(timeout); resolve({ elapsed: performance.now() - start, months: value - before, steps }); } }, 10); const timeout = setTimeout(() => { clearInterval(timer); reject(new Error('Timeline did not advance')); }, 4000); })`);
    assert.equal(elapsed.months, speed * 4, `${speed}x advances ${speed * 4} months in two seconds`);
    assert.ok(elapsed.elapsed > 1600 && elapsed.elapsed < 2600, `${speed}x timing: ${elapsed.elapsed}ms`);
    assert.deepEqual(elapsed.steps, speed === 0.5 ? [1, 1] : speed === 1.5 ? [1, 2, 1, 2] : Array(4).fill(speed), 'Fractional months carry across half-second beats');
    await click('button[aria-label="Pause timeline"]');
  }
  const pausedValue = await evaluate("document.querySelector('.timeline-slider input').value");
  await delay(500);
  assert.equal(await evaluate("document.querySelector('.timeline-slider input').value"), pausedValue, 'Pause cancels the playback timer');
  await click('button[aria-label="Play timeline"]');
  await waitFor("document.querySelector('.timeline-speed select').value === '2'", 'Playback speed survives pause and resume');
  await chooseSpeed(0.5);
  await chooseSpeed(2);
  assert.equal(await evaluate("Boolean(document.querySelector('button[aria-label=\"Pause timeline\"]'))"), true, 'Changing speed keeps playback running');
  await click('button[aria-label="Pause timeline"]');
  await input('.timeline-slider input', String(2026 * 12 + 10));
  await click('button[aria-label="Play timeline"]');
  await waitFor("document.querySelector('.timeline-slider input').value === String(2026 * 12 + 11) && document.querySelector('button[aria-label=\"Play timeline\"]')", 'Playback stops at the end without overshooting');
  await click('button[aria-label="Play timeline"]');
  await waitFor("Number(document.querySelector('.timeline-slider input').value) < 1901 * 12", 'Playing from the end restarts the timeline');
  await click('button[aria-label="Pause timeline"]');
  await click('.timeline-heading .text-link');
  console.log('PASS: playback rates are 1/2/3/4 months per second with half-second beats, pause/resume and end/restart behavior.');
  await click('#test-characters');
  await waitFor("document.querySelector('.character-form button[type=submit]:not(:disabled)')", 'Character storage is ready');
  await input('[name="character-name"]', 'Browser-only character');
  await input('[name="character-title"]', 'A private office');
  const { root: uploadRoot } = await cdp('DOM.getDocument');
  const { nodeId: uploadInput } = await cdp('DOM.querySelector', { nodeId: uploadRoot.nodeId, selector: '[name="character-portrait"]' });
  await cdp('DOM.setFileInputFiles', { nodeId: uploadInput, files: [fileURLToPath(new URL('../public/portraits/iran/Masoud_Pezeshkian.jpg', import.meta.url))] });
  await waitFor("document.querySelector('.character-portrait-preview img') && !document.querySelector('.character-form button[type=submit]').disabled", 'Uploaded portrait is resized locally');
  await click('.character-form button[type="submit"]');
  await waitFor("document.querySelector('.custom-character h3')?.textContent === 'Browser-only character'", 'Character is created');
  const readCharacters = () => evaluate("JSON.parse(localStorage.getItem('atlas-people-v1:fixture-a'))");
  assert.equal((await readCharacters()).people.length, 1);
  assert.match((await readCharacters()).people[0].imageUrl, /^data:image\/webp;base64,/);
  await click('#test-account');
  await waitFor("document.querySelector('#test-account').textContent === 'fixture-b' && !document.querySelector('.custom-character')", 'Another account cannot see private characters');
  await click('#test-account');
  await waitFor("document.querySelector('.custom-character h3')?.textContent === 'Browser-only character'", 'Original account restores its own characters');
  // Storage failures keep the entered form and report that no save happened.
  await input('[name="character-name"]', 'Unsaved draft');
  await input('[name="character-title"]', 'Storage failure');
  await evaluate("window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); }");
  await click('.character-form button[type="submit"]');
  await waitFor("document.querySelector('.character-form .form-error')?.textContent.includes('not saved')", 'Quota error is visible');
  assert.equal(await evaluate("document.querySelector('[name=character-name]').value"), 'Unsaved draft');
  assert.equal((await readCharacters()).people.length, 1);
  await evaluate("Storage.prototype.setItem = window.originalSetItem; delete window.originalSetItem");
  await screenshot('atlas-characters-desktop');
  await click('.custom-character .text-link');
  await waitFor("document.querySelector('.map-pin[data-person-id^=\"custom:\"]')", 'Custom portrait appears on the map');
  const pinSelector = '.map-pin[data-person-id^="custom:"]';
  const markerPoint = () => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(pinSelector)}).getBoundingClientRect(); return {x:r.x + r.width/2, y:r.y + r.height/2}; })()`);
  const transformBeforeDrag = await evaluate("document.querySelector('.world-map > g').getAttribute('transform')");
  const point = await markerPoint();
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  for (let step = 1; step <= 6; step++) await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + step * 10, y: point.y + step * 5, button: 'left', buttons: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x + 60, y: point.y + 30, button: 'left', clickCount: 1 });
  await waitFor("Object.keys(JSON.parse(localStorage.getItem('atlas-people-v1:fixture-a')).positions).length === 1", 'Mouse drag persists a marker position');
  assert.equal(await evaluate("document.querySelector('.world-map > g').getAttribute('transform')"), transformBeforeDrag, 'Dragging a portrait must not pan the map');
  const stored = await readCharacters();
  const id = stored.people[0].id;
  const previousX = stored.positions[id].x;
  await evaluate(`document.querySelector(${JSON.stringify(pinSelector)}).dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true}))`);
  await waitFor(`JSON.parse(localStorage.getItem('atlas-people-v1:fixture-a')).positions[${JSON.stringify(id)}].x > ${previousX}`, 'Keyboard movement persists');
  const savedPosition = (await readCharacters()).positions[id];
  await navigate(fixtureOrigin);
  await waitFor("document.querySelector('.map-pin[data-person-id^=\"custom:\"]')", 'Custom character survives a reload');
  assert.deepEqual((await readCharacters()).positions[id], savedPosition, 'Portrait position survives a reload');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await delay(200);
  const touchPoint = await markerPoint();
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...touchPoint, id: 1 }] });
  for (let step = 1; step <= 4; step++) await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchPoint.x - step * 8, y: touchPoint.y + step * 4, id: 1 }] });
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitFor(`JSON.parse(localStorage.getItem('atlas-people-v1:fixture-a')).positions[${JSON.stringify(id)}].x < ${savedPosition.x}`, 'Touch drag persists on a phone');
  await click('#test-characters');
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Character page fits mobile width');
  await screenshot('atlas-characters-mobile');
  await click('.custom-character .icon-button');
  await waitFor("!document.querySelector('.custom-character')", 'Custom character can be removed');
  assert.deepEqual((await readCharacters()).positions, {}, 'Removing a character removes its saved position');
  await click('#test-characters');
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  console.log('PASS: browser character creation, account isolation, quota failures, reload persistence, mouse/touch/keyboard marker movement, mobile form and deletion cleanup.');
  await delay(1500);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "Desktop has horizontal overflow");
  const assertInspectorHeight = async label => {
    assert.equal(await evaluate("(() => { const map = document.querySelector('.map-card').getBoundingClientRect(); const inspector = document.querySelector('.inspector').getBoundingClientRect(); return Math.abs(map.top - inspector.top) <= 1 && Math.abs(map.height - inspector.height) <= 1; })()"), true, label);
  };
  for (const width of [1024, 1440, 1920]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1080, deviceScaleFactor: 1, mobile: false });
    await click('#test-map-controls');
    await assertInspectorHeight('Layers inspector matches map height at ' + width);
    assert.equal(await evaluate("document.querySelector('.inspector [role=tablist],.inspector [role=tab],.inspector .appearance-controls') === null"), true, 'Inspector contains only layer controls');
    await click('.map-pin');
    await assertInspectorHeight('Person inspector matches map height at ' + width);
    await evaluate("document.querySelector('.inspector').insertAdjacentHTML('beforeend', '<div id=overflow-fixture style=height:2000px>Long details</div>')");
    await assertInspectorHeight('Long details cannot resize map at ' + width);
    assert.equal(await evaluate("document.querySelector('.inspector').scrollHeight > document.querySelector('.inspector').clientHeight"), true, 'Long content scrolls inside inspector');
    await evaluate("document.querySelector('#overflow-fixture').remove(); document.documentElement.dir = 'rtl'");
    await assertInspectorHeight('RTL inspector matches map height at ' + width);
    await evaluate("document.documentElement.dir = 'ltr'");
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await screenshot("atlas-desktop");
  await click('button[aria-label="Zoom in"]');
  await waitFor("document.querySelector('.map-scale').textContent.includes('1.4')", "Zoom changes view");
  await click('button[aria-label="Reset map position"]');
  for (let i = 0; i < 20; i++) await click('button[aria-label="Zoom in"]');
  await waitFor("document.querySelector('.map-scale').textContent.includes('64.0') && document.querySelector('button[aria-label=\"Zoom in\"]').disabled", "Buttons reach the new 64x maximum");
  await click('button[aria-label="Reset map position"]');
  await evaluate("(() => { const el = document.querySelector('.map-stage'); const r = el.getBoundingClientRect(); el.dispatchEvent(new WheelEvent('wheel', {deltaY:-100000,clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true,cancelable:true})); })()");
  await waitFor("document.querySelector('.map-scale').textContent.includes('64.0')", "Wheel reaches the same maximum");
  await click('button[aria-label="Reset map position"]');
  await click('.map-pin');
  await waitFor("document.querySelector('.person-spotlight h3')", "Selecting a portrait opens its details");
  const selectedName = await evaluate("document.querySelector('.person-spotlight h3').textContent");
  const assertInspectorToggle = async label => {
    const selector = '.map-controls button[aria-label="Map controls"]';
    await click(selector);
    await waitFor("document.querySelector('.map-inspector-hidden')", label + ': settings icon hides inspector');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.inspector')).display"), 'none');
    assert.equal(await evaluate("document.querySelector('.map-controls button[aria-label=\"Map controls\"]').getAttribute('aria-expanded')"), 'false');
    assert.equal(await evaluate("Boolean(document.querySelector('.map-expanded'))"), true, 'Map stays fullscreen');
    await click(selector);
    await waitFor("!document.querySelector('.map-inspector-hidden')", label + ': settings icon restores inspector');
    assert.equal(await evaluate("document.querySelector('.map-controls button[aria-label=\"Map controls\"]').getAttribute('aria-expanded')"), 'true');
  };
  const assertTimelineToggle = async label => {
    const value = await evaluate("document.querySelector('.timeline-slider input').value");
    await click('.map-controls button[aria-controls="map-timeline"]');
    assert.equal(await evaluate("document.querySelector('.timeline').hidden && getComputedStyle(document.querySelector('.timeline')).display === 'none' && document.querySelector('.map-controls button[aria-controls=\"map-timeline\"]').getAttribute('aria-expanded') === 'false'"), true, label + ': clock hides the timeline');
    assert.equal(await evaluate("Boolean(document.querySelector('.map-expanded'))"), true, 'Clock keeps the map fullscreen');
    await click('.map-controls button[aria-controls="map-timeline"]');
    assert.equal(await evaluate("!document.querySelector('.timeline').hidden && document.querySelector('.map-controls button[aria-controls=\"map-timeline\"]').getAttribute('aria-expanded') === 'true'"), true, label + ': clock restores the timeline');
    assert.equal(await evaluate("document.querySelector('.timeline-slider input').value"), value, 'Clock preserves the selected date');
  };
  const assertDrawing = async (label, touch = false) => {
    await click('button[aria-label="Reset map position"]');
    await click('.map-controls button[aria-label="Map controls"]');
    await click('.map-controls button[aria-controls="map-timeline"]');
    const fingerprint = () => evaluate("({countries:[...document.querySelectorAll('.country')].map(p => [p.dataset.country,p.getAttribute('d')]), portraits:[...document.querySelectorAll('.map-pin')].map(p => p.dataset.personId), positions:JSON.parse(localStorage.getItem('atlas-people-v1:fixture-a')).positions, layers:[...document.querySelectorAll('.inspector input')].map(input => [input.name,input.checked])})");
    const original = await fingerprint();
    const view = () => evaluate("document.querySelector('.world-map > g').getAttribute('transform')");
    const originalView = await view();
    const stroke = async points => {
      if (touch) {
        await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[0], id: 1 }] });
        for (const p of points.slice(1)) await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...p, id: 1 }] });
        await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...points[0] });
        await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...points[0], button: 'left', clickCount: 1 });
        for (const p of points.slice(1)) await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p, button: 'left', buttons: 1 });
        await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...points.at(-1), button: 'left', clickCount: 1 });
      }
    };
    if (touch) await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await click('.map-controls > button[aria-label="Drawing tools"]');
    await waitFor("document.querySelector('.map-drawing').dataset.drawingTool === 'pencil'", label + ': pencil opens ready to draw');
    assert.equal(await evaluate("(() => { const el = document.querySelector('#map-drawing-tools button[aria-label=\"Erase pencil strokes\"]'); const r = el.getBoundingClientRect(); return r.width > 0 && el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); })()"), true, label + ': eraser button is visible and clickable');
    const { x, y } = await evaluate("(() => { const r = document.querySelector('.map-stage').getBoundingClientRect(); return {x:r.x+r.width*.5,y:r.y+r.height*.5}; })()");
    await click('#map-drawing-tools button[aria-label="Blue"]');
    await stroke([{ x: x-24, y }, { x: x-12, y: y-12 }, { x, y }, { x: x+12, y: y+12 }, { x: x+24, y }]);
    await waitFor("document.querySelectorAll('[data-pencil-stroke]').length === 1", label + ': first freehand stroke appears');
    assert.equal(await evaluate("document.querySelector('[data-pencil-stroke]').getAttribute('stroke')"), '#2563eb', 'Pencil uses the selected palette color');
    await input('#map-drawing-tools input[type=color]', '#e11d48');
    await stroke([{ x: x-24, y: y+60 }, { x, y: y+68 }, { x: x+24, y: y+60 }]);
    await waitFor("document.querySelectorAll('[data-pencil-stroke]').length === 2", label + ': separate strokes are retained');
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-pencil-stroke]')].map(p => p.getAttribute('stroke'))"), ['#2563eb', '#e11d48'], 'Custom pencil color leaves the previous stroke unchanged');
    assert.equal(await view(), originalView, 'Drawing does not pan the map');
    const secondPath = await evaluate("document.querySelectorAll('[data-pencil-stroke]')[1].getAttribute('d')");
    await screenshot(`atlas-drawing-${label.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
    await click('#map-drawing-tools button[aria-label="Erase pencil strokes"]');
    await stroke([{ x, y: y-24 }, { x, y: y+24 }]);
    await waitFor("document.querySelectorAll('[data-pencil-stroke]').length === 1", label + ': eraser removes only the touched stroke');
    assert.equal(await evaluate("document.querySelector('[data-pencil-stroke]').getAttribute('d')"), secondPath, 'Unrelated pencil stroke survives erasing');
    await click('button[aria-label="Zoom in"]');
    await waitFor("document.querySelector('.world-map > g').getAttribute('transform').includes('1.4')");
    assert.equal(await evaluate("document.querySelector('.map-drawing > g').getAttribute('transform')"), await view(), 'Drawings follow map zoom');
    assert.equal(await evaluate("document.querySelector('[data-pencil-stroke]').getAttribute('d')"), secondPath, 'Zoom preserves map coordinates of drawings');
    await click('button[aria-label="Reset map position"]');
    if (touch) {
      await click('#map-drawing-tools button[aria-label="Pencil"]');
      const points = distance => [{ x: x-distance, y, id: 3 }, { x: x+distance, y, id: 4 }];
      await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(20) });
      for (const distance of [25, 30, 35, 40]) await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(distance) });
      await waitFor("Math.abs(document.querySelector('.world-map > g').transform.baseVal.consolidate().matrix.a - 2) < .02", label + ': two fingers zoom while pencil is selected');
      await cdp('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.equal(await evaluate("document.querySelectorAll('[data-pencil-stroke]').length"), 1, 'Pinching cancels the temporary pencil stroke');
      await click('button[aria-label="Reset map position"]');
    }
    await click('#map-drawing-tools button[aria-label="Pan map"]');
    await stroke([{ x, y }, { x: x+20, y: y+10 }]);
    await waitFor(`document.querySelector('.world-map > g').getAttribute('transform') !== ${JSON.stringify(originalView)}`, label + ': hand tool restores map panning');
    assert.equal(await evaluate("document.querySelector('.map-drawing > g').getAttribute('transform')"), await view(), 'Drawings follow map panning');
    await click('button[aria-label="Reset map position"]');
    await click('#map-drawing-tools button[aria-label="Erase pencil strokes"]');
    await stroke([{ x, y: y+40 }, { x, y: y+85 }]);
    await waitFor("document.querySelectorAll('[data-pencil-stroke]').length === 0", label + ': eraser can clear the remaining drawing');
    const portrait = await evaluate("(() => { for (const pin of document.querySelectorAll('.map-pin')) { const r = pin.getBoundingClientRect(); const x = r.x+r.width/2, y = r.y+r.height/2; if (x > 60 && x < innerWidth-40 && y > 120 && y < innerHeight-40) return {x,y}; } return null; })()");
    assert.ok(portrait, 'A portrait remains available for the eraser safety test');
    await stroke([portrait, { x: portrait.x+15, y: portrait.y+10 }]);
    assert.deepEqual(await fingerprint(), original, label + ': eraser preserves every country, portrait, layer and stored position');
    await click('#map-drawing-tools button[aria-label="Measure distance"]');
    const rulerPoints = await evaluate("(() => { const r = document.querySelector('.map-stage').getBoundingClientRect(); return [-24,0,24].map(dx => ({x:r.x+r.width*.5+dx,y:r.y+r.height*.75})); })()");
    const total = () => evaluate("Number(document.querySelector('[data-measurement-total]').dataset.measurementTotal)");
    for (const [index, point] of rulerPoints.entries()) {
      await stroke([point]);
      await waitFor(`document.querySelectorAll('[data-measurement-point]').length === ${index+1}`, label + ': ruler adds point ' + (index+1));
    }
    const rulerTotal = await total();
    assert.ok(rulerTotal > 0, 'Ruler reports a positive geographic distance');
    assert.equal(await evaluate("document.querySelectorAll('.map-measurement li').length"), 2, 'Three points produce two distance segments');
    const rulerPath = await evaluate("document.querySelector('[data-measurement-path]').getAttribute('d')");
    await screenshot(`atlas-ruler-${label.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
    assert.equal(await evaluate("(() => { const r=document.querySelector('#map-drawing-tools').getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight; })()"), true, 'Ruler panel fits the viewport');
    await click('button[aria-label="Zoom in"]');
    assert.equal(await total(), rulerTotal, 'Zoom cannot change measured kilometers');
    assert.equal(await evaluate("document.querySelector('[data-measurement-path]').getAttribute('d')"), rulerPath, 'Measurement stays in map coordinates');
    await click('#map-drawing-tools button[aria-label="Erase pencil strokes"]');
    await stroke([rulerPoints[1]]);
    assert.equal(await evaluate("document.querySelectorAll('[data-measurement-point]').length"), 3, 'Eraser cannot remove ruler points');
    await click('#map-drawing-tools button[aria-label="Measure distance"]');
    if (touch) {
      const before = await total();
      const pinchPoints = distance => [{ x: x-distance, y: y+45, id: 7 }, { x: x+distance, y: y+45, id: 8 }];
      await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pinchPoints(20) });
      await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pinchPoints(35) });
      await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await total(), before, 'Two-finger ruler gestures add no accidental measurement point');
    }
    await click('#map-drawing-tools button[aria-label="Undo measurement point"]');
    await waitFor("document.querySelectorAll('[data-measurement-point]').length === 2");
    assert.ok(await total() < rulerTotal, 'Undo updates the total');
    await click('#map-drawing-tools button[aria-label="Clear measurement"]');
    assert.equal(await total(), 0);
    assert.equal(await evaluate("document.querySelectorAll('[data-measurement-point], [data-measurement-path]').length"), 0, 'Clear removes only measurement geometry');
    await click('button[aria-label="Reset map position"]');
    await click('.map-controls > button[aria-label="Drawing tools"]');
    assert.equal(await evaluate("document.querySelector('.map-drawing').dataset.drawingTool"), 'pan', 'Closing tools restores map interaction');
    if (touch) await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    await click('.map-controls button[aria-label="Map controls"]');
    await click('.map-controls button[aria-controls="map-timeline"]');
    console.log(`PASS: ${label} pencil colors, selective eraser, multi-point ruler, undo/clear, protected map content, zoom/pan alignment${touch ? ' and two-finger gesture takeover' : ''}.`);
  };
  const assertPinch = async label => {
    await click('button[aria-label="Reset map position"]');
    await click('.timeline-heading .text-link');
    await click('.map-controls button[aria-label="Map controls"]');
    await click('.map-controls button[aria-controls="map-timeline"]');
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    const readView = () => evaluate("(() => { const matrix = document.querySelector('.world-map > g').transform.baseVal.consolidate().matrix; return {k:matrix.a,x:matrix.e,y:matrix.f}; })()");
    const center = await evaluate("(() => { const r = document.querySelector('.map-stage').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height*.62}; })()");
    const points = distance => [{ x: center.x - distance, y: center.y, id: 1 }, { x: center.x + distance, y: center.y, id: 2 }];
    await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(30) });
    for (const distance of [36, 42, 48, 54, 60]) await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(distance) });
    await waitFor("Math.abs(document.querySelector('.world-map > g').transform.baseVal.consolidate().matrix.a - 2) < .02", label + ': spreading two fingers doubles map zoom');
    for (const distance of [54, 48, 42, 36, 30]) await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(distance) });
    await waitFor("Math.abs(document.querySelector('.world-map > g').transform.baseVal.consolidate().matrix.a - 1) < .02", label + ': pinching returns to the minimum');
    await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [points(30)[1]] });
    const beforePan = await readView();
    const remaining = points(30)[0];
    await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...remaining, x: remaining.x + 25 }] });
    await waitFor(`document.querySelector('.world-map > g').transform.baseVal.consolidate().matrix.e > ${beforePan.x + 5}`, label + ': the remaining finger continues panning');
    await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await click('button[aria-label="Reset map position"]');
    const portrait = await evaluate("(() => { for (const pin of document.querySelectorAll('.map-pin')) { const r = pin.getBoundingClientRect(); const x = r.x+r.width/2, y = r.y+r.height/2; if (x > 65 && x < innerWidth-90 && y > 60 && y < innerHeight-40 && pin.contains(document.elementFromPoint(x,y))) return {x,y}; } return null; })()");
    assert.ok(portrait, label + ': a visible portrait is available for gesture takeover');
    const savedPositions = await evaluate("JSON.parse(localStorage.getItem('atlas-people-v1:fixture-a')).positions");
    const first = { ...portrait, id: 11 };
    await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
    first.x += 6;
    await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [first] });
    const second = { x: first.x + 50, y: first.y, id: 12 };
    await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
    await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [first, { ...second, x: second.x + 50 }] });
    await waitFor("Math.abs(document.querySelector('.world-map > g').transform.baseVal.consolidate().matrix.a - 2) < .02", label + ': a second finger turns a portrait drag into map zoom');
    await cdp('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('atlas-people-v1:fixture-a')).positions"), savedPositions, 'Pinching from a portrait never persists its temporary drag');
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    assert.equal(await evaluate("window.visualViewport.scale"), 1, 'Pinching zooms the map without zooming the page');
    await click('.map-controls button[aria-label="Map controls"]');
    await click('.map-controls button[aria-controls="map-timeline"]');
    await click('button[aria-label="Reset map position"]');
  };
  const assertOverlays = async label => {
    assert.equal(await evaluate(`(() => {
      const root = document.querySelector('.map-experience');
      const stage = root.querySelector('.map-stage').getBoundingClientRect();
      const inspector = root.querySelector('.inspector').getBoundingClientRect();
      const timeline = root.querySelector('.timeline').getBoundingClientRect();
      const inside = r => r.width > 0 && r.height > 0 && r.left >= stage.left - 1 && r.right <= stage.right + 1 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1;
      const button = root.querySelector('.timeline-play');
      const b = button.getBoundingClientRect();
      return inside(inspector) && inside(timeline) && inspector.bottom <= timeline.top && button.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
    })()`), true, `${label}: overlays must be inside the map, separate, and clickable`);
  };
  const assertSpeedControl = async label => {
    const actual = await evaluate("(() => { const select = document.querySelector('.timeline-speed select'); const r = select.getBoundingClientRect(); const timeline = document.querySelector('.timeline').getBoundingClientRect(); const date = document.querySelector('.timeline-date').getBoundingClientRect(); return r.width > 0 && r.left >= timeline.left && r.right <= timeline.right && r.top >= timeline.top && r.bottom <= timeline.bottom && (r.right <= date.left || r.left >= date.right || r.bottom <= date.top || r.top >= date.bottom) && select === document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); })()");
    assert.equal(actual, true, `${label}: clock speed control is visible, clickable and separate from the date`);
  };
  await click('button[aria-label="Enter fullscreen"]');
  await waitFor("document.fullscreenElement === document.querySelector('.map-experience') && document.querySelector('.map-experience').dataset.fullscreen === 'native'", "Browser native fullscreen activates");
  await assertCountryHints('Desktop fullscreen');
  assert.equal(await evaluate("Math.abs(document.querySelector('.map-experience').getBoundingClientRect().height - innerHeight) <= 1"), true, "Fullscreen fills the display");
  await assertOverlays('Desktop fullscreen');
  await assertInspectorToggle('Desktop fullscreen');
  await assertTimelineToggle('Desktop fullscreen');
  await assertDrawing('Desktop fullscreen');
  await click('.timeline-ticks button');
  await click('button[aria-label="Play timeline"]');
  await chooseSpeed(0.5);
  await assertSpeedControl('Desktop fullscreen');
  await evaluate("document.querySelector('.timeline-speed select').focus()");
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  await waitFor("document.querySelector('.timeline-speed span').textContent === '2x'", 'Keyboard changes the native clock speed control');
  await chooseSpeed(0.5);
  await screenshot('atlas-timeline-speed-desktop');
  await click('button[aria-label="Pause timeline"]');
  await click('.timeline-heading .text-link');
  assert.equal(await evaluate("document.fullscreenElement.contains(document.querySelector('.timeline')) && document.fullscreenElement.contains(document.querySelector('.person-spotlight'))"), true, 'Timeline and person details belong to native fullscreen');
  const dateBefore = await evaluate("document.querySelector('.timeline-date strong').textContent");
  await click('button[aria-label="Previous month"]');
  await waitFor(`document.querySelector('.timeline-date strong').textContent !== ${JSON.stringify(dateBefore)}`, 'Timeline remains interactive in fullscreen');
  assert.equal(await evaluate("document.querySelector('.person-spotlight h3').textContent"), selectedName);
  await screenshot("atlas-fullscreen");
  await click('button[aria-label="Exit fullscreen"]');
  await waitFor("!document.fullscreenElement && !document.querySelector('.map-expanded')", "Exit button closes fullscreen");
  await click('button[aria-label="Enter fullscreen"]');
  await waitFor("document.fullscreenElement && document.querySelector('.map-experience').dataset.fullscreen === 'native' && document.body.style.overflow === 'hidden'");
  await evaluate("document.querySelector('.map-stage').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  await waitFor("!document.fullscreenElement && !document.querySelector('.map-expanded')", "Escape closes fullscreen and syncs controls");
  await evaluate("void Object.defineProperty(document.querySelector('.map-experience'), 'requestFullscreen', {configurable:true, value: () => Promise.reject(new Error('Test unsupported fullscreen'))})");
  await click('button[aria-label="Enter fullscreen"]');
  await waitFor("document.querySelector('.map-experience').dataset.fullscreen === 'fallback'", "Denied fullscreen falls back to an expanded map");
  await assertOverlays('Desktop fallback');
  await assertInspectorToggle('Desktop fallback');
  await assertTimelineToggle('Desktop fallback');
  await assertDrawing('Desktop fallback');
  await evaluate("document.querySelector('.map-stage').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); delete document.querySelector('.map-experience').requestFullscreen");
  await waitFor("!document.querySelector('.map-expanded')");
  for (const [width, height] of [[320, 640], [390, 844], [844, 390]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await delay(300);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Mobile map has horizontal overflow');
    if (width <= 760) assert.equal(await evaluate("(() => { const r = document.querySelector('.map-stage').getBoundingClientRect(); return Math.abs(r.width / r.height - 1000 / 700) < .02 && r.right <= innerWidth; })()"), true, 'Mobile map fits its responsive aspect ratio');
    await click('button[aria-label="Enter fullscreen"]');
    await waitFor("document.querySelector('.map-expanded')", 'Mobile fullscreen activates');
    await assertOverlays(`Mobile ${width}x${height}`);
    await assertInspectorToggle(`Mobile ${width}x${height}`);
    await assertTimelineToggle(`Mobile ${width}x${height}`);
    await assertCountryHints(`Mobile ${width}x${height}`, true);
    assert.equal(await evaluate("document.querySelector('.world-map').getAttribute('preserveAspectRatio')"), 'xMidYMid slice', 'Initial phone map fits both viewport dimensions');
    await assertPinch(`Mobile ${width}x${height}`);
    await assertDrawing(`Mobile ${width}x${height}`, true);
    await click('.timeline-ticks button');
    await click('button[aria-label="Play timeline"]');
    await chooseSpeed(0.5);
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale', '1.3')");
    await assertSpeedControl(`Mobile ${width}x${height}`);
    await screenshot(`atlas-fullscreen-${width}`);
    await click('button[aria-label="Pause timeline"]');
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale', '1')");
    await click('button[aria-label="Exit fullscreen"]');
    await waitFor("!document.querySelector('.map-expanded')", 'Mobile fullscreen exits');
    await evaluate("void Object.defineProperty(document.querySelector('.map-experience'), 'requestFullscreen', {configurable:true, value:undefined}); document.documentElement.dir = 'rtl'");
    await click('button[aria-label="Enter fullscreen"]');
    await waitFor("document.querySelector('.map-experience').dataset.fullscreen === 'fallback'", 'Unsupported mobile fullscreen uses fallback');
    await assertOverlays(`RTL mobile fallback ${width}x${height}`);
    await assertInspectorToggle(`RTL mobile fallback ${width}x${height}`);
    await assertTimelineToggle(`RTL mobile fallback ${width}x${height}`);
    await assertCountryHints(`RTL mobile fallback ${width}x${height}`, true);
    await assertPinch(`RTL mobile fallback ${width}x${height}`);
    await assertDrawing(`RTL mobile fallback ${width}x${height}`, true);
    await click('.timeline-ticks button');
    await click('button[aria-label="Play timeline"]');
    await chooseSpeed(0.5);
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale', '1.3')");
    await assertSpeedControl(`RTL mobile fallback ${width}x${height}`);
    await click('button[aria-label="Pause timeline"]');
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale', '1')");
    await evaluate("document.querySelector('.inspector button').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); delete document.querySelector('.map-experience').requestFullscreen; document.documentElement.dir = 'ltr'");
    await waitFor("!document.querySelector('.map-expanded') && document.body.style.overflow !== 'hidden'", 'Escape in details closes fallback and restores scrolling');
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  // Switch language in place, as users do, retaining the same input widget.
  await click('[data-testid="language-switcher"]');
  await waitFor("document.documentElement.lang === 'fa'");
  await assertCountryHints('Persian mobile', true);
  await navigate(`${fixtureOrigin}?locale=fa`);
  await waitFor("document.documentElement.lang === 'fa' && Boolean(document.querySelector('.world-map'))");
  await click('button[aria-label="نمایش تمام‌صفحه"]');
  await waitFor("Boolean(document.querySelector('.map-expanded'))");
  await click('.map-controls button[aria-controls="map-drawing-tools"]');
  await waitFor("Boolean(document.querySelector('[aria-label=\"رنگ مداد\"]'))");
  await screenshot('atlas-pencil-fa');
  await click('#map-drawing-tools button[aria-label="اندازه‌گیری مسافت"]');
  assert.equal(await evaluate("document.querySelector('.map-measurement').innerText.includes('مسافت کل') && document.querySelector('.map-measurement output').textContent.includes('متر')"), true, 'Persian ruler labels and units are translated');
  await screenshot('atlas-ruler-fa');
  await click('.map-controls button[aria-controls="map-drawing-tools"]');
  await click('button[aria-label="خروج از تمام‌صفحه"]');
  await screenshot('atlas-mobile');
  assert.deepEqual(exceptions, [], "Browser raised runtime exceptions");
  console.log("PASS: 64x zoom, real two-finger zoom/pan and portrait gesture takeover, fullscreen clock toggle, native/fallback fullscreen, responsive portrait/landscape sizing, and RTL overlays.");
  console.log("Screenshots saved to outputs/atlas-{desktop,mobile,signin,fullscreen}.png");
  }
  await send("Browser.close");
} catch (error) {
  console.error('Browser diagnostics:', JSON.stringify({ exceptions, page: await debugPage?.().catch(() => null) }));
  await captureFailure?.().catch(() => {});
  throw error;
} finally { socket?.close(); chrome.kill("SIGTERM"); await fixtureServer?.close(); }
