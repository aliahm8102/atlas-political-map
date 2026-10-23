import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const origin = process.env.ATLAS_TEST_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname), "Use the local demo server");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-auth-ux-"));
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
  diagnostics = async () => { await screenshot("auth-ux-failure"); return evaluate("({url:location.pathname+location.search,heading:document.querySelector('h1')?.textContent,body:document.body.innerText.slice(-800)})"); };
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp('Network.enable');
  await cdp('Network.setBlockedURLs',{urls:['*://*.supabase.co/*','*://*.supabase.in/*','*://atlas-auth-test.invalid/*']});
  const authRequests=[];
  socket.addEventListener('message',({data})=>{const event=JSON.parse(String(data));if(event.method==='Network.requestWillBeSent' && /\/auth\/v1\//.test(event.params.request.url))authRequests.push(event.params.request.method);});
  await navigate('/login');
  await waitFor("document.querySelector('.auth-switch-button') && document.querySelector('input[name=password]')");
  await waitFor("(() => {if(document.querySelector('button[aria-label=\"Hide password\"]'))return true;document.querySelector('button[aria-label=\"Show password\"]')?.click();return false;})()");
  await click('button[aria-label="Hide password"]');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.auth-switch strong')).fontSize"),'16px');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.auth-switch-button')).fontSize"),'15px');
  assert.ok(await evaluate("document.querySelector('.auth-switch-button').getBoundingClientRect().height>=48"));
  const password='input[name=password]';
  const checkLimit=async()=>{
    assert.equal(await evaluate("document.querySelector('input[name=password]').maxLength"),32);
    await type(password,'x'.repeat(32));
    assert.equal(await evaluate("document.querySelector('input[name=password]').value.length"),32);
    await cdp('Input.insertText',{text:'extra'});
    assert.equal(await evaluate("document.querySelector('input[name=password]').value.length"),32,'Typing beyond the limit is blocked');
    await type(password,'p'.repeat(80));
    assert.equal(await evaluate("document.querySelector('input[name=password]').value.length"),32,'Pasted text cannot exceed the limit');
    await type(password,'short77');
    assert.equal(await evaluate("document.querySelector('input[name=password]').checkValidity()"),false);
    await type(password,'valid888');
    assert.equal(await evaluate("document.querySelector('input[name=password]').checkValidity()"),true);
    await type(password,'b'.repeat(32));
    assert.equal(await evaluate("document.querySelector('input[name=password]').checkValidity()"),true,'A 32-character password is accepted');
    assert.equal(await evaluate("document.querySelector('input[name=password]').getAttribute('aria-describedby')"),'auth-password-hint');
    await evaluate("(() => {Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(document.querySelector('input[name=password]'),'z'.repeat(33));document.querySelector('.auth-card form').requestSubmit();})()");
    await waitFor("document.querySelector('.form-error')?.textContent.includes('8 and 32')");
  };
  await type('input[autocomplete=email]','explorer@example.test');
  await checkLimit();
  await click('button[aria-label="Show password"]');
  assert.equal(await evaluate("document.querySelector('input[name=password]').type"),'text');
  await type(password,'v'.repeat(50));
  assert.equal(await evaluate("document.querySelector('input[name=password]').value.length"),32,'Limit also applies when the password is visible');
  assert.equal(await evaluate("document.querySelector('.form-error')===null"),true,'Correcting the length clears the length error');
  await screenshot('auth-ux-desktop');
  await evaluate("document.querySelector('.auth-switch-button').focus()");
  await key('Enter');
  await waitFor("document.querySelector('input[autocomplete=name]')");
  assert.equal(await evaluate("document.querySelector('.auth-switch-button').textContent.includes('Sign in')"),true);
  await type('input[autocomplete=name]','Test Explorer');
  await checkLimit();
  await click('.auth-switch-button');
  await click('.forgot');
  await waitFor("!document.querySelector('input[name=password]')");
  await click('.auth-switch-button');
  await waitFor("document.querySelector('input[name=password]')");
  await navigate('/auth/update-password');
  await waitFor("document.querySelector('input[autocomplete=\"new-password\"]')");
  await waitFor("(() => {if(document.querySelector('button[aria-label=\"Hide password\"]'))return true;document.querySelector('button[aria-label=\"Show password\"]')?.click();return false;})()");
  await checkLimit();
  assert.equal(await evaluate("document.querySelector('.auth-switch')===null"),true);
  await navigate('/login');
  await waitFor("document.querySelector('.auth-switch-button')");
  await waitFor("(() => {if(document.querySelector('button[aria-label=\"Hide password\"]'))return true;document.querySelector('button[aria-label=\"Show password\"]')?.click();return false;})()");
  await click('[data-testid="language-switcher"]');
  await waitFor("document.documentElement.lang==='fa'");
  for(const width of [320,390]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate("document.querySelector('.auth-page').style.setProperty('--font-scale','1.3');document.querySelector('.auth-switch').scrollIntoView({block:'center'})");
    await evaluate("document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))");
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'Persian auth layout fits small phones at 130% font size');
    assert.equal(await evaluate("document.querySelector('.auth-switch-button').textContent.includes('ساخت حساب')"),true);
    assert.equal(await evaluate("document.querySelector('#auth-password-hint').textContent"),'۸ تا ۳۲ نویسه');
    await screenshot(`auth-ux-fa-${width}`);
  }
  assert.deepEqual(authRequests,[],'No registration, recovery email or authentication request is sent by these checks');
  assert.deepEqual(exceptions,[]);
  console.log('PASS: readable full-width account action, keyboard mode switching, login/signup/update password limits, typing/paste, boundary validation, visible passwords, no auth requests, Persian and mobile layouts.');
  await cdp('Browser.close');
} catch(error){console.error('Auth UX diagnostics:',await diagnostics?.().catch(()=>null));throw error;}
finally{socket?.close();chrome.kill();}
