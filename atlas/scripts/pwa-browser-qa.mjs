import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const origin = process.env.ATLAS_TEST_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname), "Use a local production server");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-pwa-"));
const chrome = spawn(process.env.ATLAS_CHROME_BIN || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome"), ["--headless=new", "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
let socket;
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
    const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(150); }
    throw new Error(`Timed out waiting for ${expression}`);
  };
  await cdp("Page.enable");
  await cdp("Network.enable");
  await cdp("Page.navigate", { url: `${origin}/login` });
  await waitFor("Boolean(document.querySelector('.auth-card'))");
  await waitFor("Boolean(navigator.serviceWorker.controller)");
  const manifest = await evaluate("fetch(document.querySelector('link[rel=manifest]').href).then(r => r.json())");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  const installability = await cdp("Page.getInstallabilityErrors");
  assert.deepEqual(installability.installabilityErrors, []);
  const headers = await fetch(`${origin}/sw.js`);
  assert.match(headers.headers.get("cache-control"), /no-store/);
  assert.equal(headers.headers.get("service-worker-allowed"), "/");
  const cached = await evaluate("caches.open('atlas-pwa-v1').then(c => c.keys()).then(keys => keys.map(k => new URL(k.url).pathname))");
  assert.equal(cached.length, 6);
  assert.equal(cached.includes("/login"), false);
  await evaluate("document.cookie = 'atlas-locale=fa; Path=/; SameSite=Lax'");
  // Service workers have their own network context in Chrome DevTools.
  const { targetInfos } = await cdp("Target.getTargets");
  const worker = targetInfos.find((target) => target.type === "service_worker" && target.url === `${origin}/sw.js`);
  assert.ok(worker);
  const { sessionId: workerSession } = await cdp("Target.attachToTarget", { targetId: worker.targetId, flatten: true });
  await cdp("Network.enable", {}, workerSession);
  await cdp("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, workerSession);
  await cdp("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await cdp("Page.navigate", { url: `${origin}/workspace` });
  await waitFor("document.querySelector('#retry') !== null");
  assert.equal(await evaluate("document.documentElement.lang"), "fa");
  assert.equal(await evaluate("document.documentElement.dir"), "rtl");
  assert.equal(await evaluate("document.querySelector('img').naturalWidth"), 192);
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  await fs.mkdir("outputs", { recursive: true });
  const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
  await fs.writeFile("outputs/pwa-offline-fa.png", Buffer.from(screenshot.data, "base64"));
  await evaluate("document.cookie = 'atlas-locale=en; Path=/; SameSite=Lax'");
  await cdp("Page.navigate", { url: `${origin}/workspace` });
  await waitFor("document.documentElement.lang === 'en' && document.querySelector('#retry') !== null");
  await cdp("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await cdp("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, workerSession);
  await evaluate("document.querySelector('#retry').click()");
  await waitFor("location.pathname === '/login' && Boolean(document.querySelector('.auth-card'))");
  console.log("PWA browser checks passed: installability, registration, cache isolation, bilingual offline page, mobile layout, and authenticated recovery.");
} finally {
  socket?.close();
  chrome.kill();
}
