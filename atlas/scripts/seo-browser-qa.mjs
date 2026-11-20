// Test the actual production server, including Proxy, HTTP metadata and SSR.
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = await new Promise(resolve => {
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1", () => { const port = probe.address().port; probe.close(() => resolve(port)); });
});
const origin = `http://127.0.0.1:${freePort}`;
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-seo-"));
await fs.mkdir("outputs", { recursive: true });
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(freePort)], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "production" } });
let chrome, socket;
const pending = new Map();
let sequence = 0;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(`${origin}/robots.txt`)).ok; } catch { /* Server starting. */ }
    if (ready) break;
    await delay(150);
  }
  assert.ok(ready, "Production server started");
  const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map(([item]) => Object.fromEntries([...item.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])));
  for (const [route, locale, heading] of [["/", "fa", "جهان را در بستر زمان و مکان بشناس"], ["/en", "en", "Discover the world through time and place"]]) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual", headers: { "User-Agent": "Googlebot", Cookie: `atlas-locale=${locale === "fa" ? "en" : "fa"}` } });
    assert.equal(response.status, 200, "The public page never redirects to sign in");
    assert.equal(response.headers.get("x-robots-tag"), null);
    const html = await response.text();
    assert.ok(html.includes(`<html lang="${locale}" dir="${locale === "fa" ? "rtl" : "ltr"}">`));
    assert.ok(html.includes(heading), "Introduction is present before JavaScript");
    const meta = tags(html, "meta");
    assert.ok(meta.some(item => item.name === "robots" && item.content.includes("index") && !item.content.includes("noindex")));
    assert.ok(meta.some(item => item.name === "description" && item.content.length > 80));
    assert.ok(meta.some(item => item.property === "og:image" && item.content === "https://atlas-peyma.ir/social/atlas-peyma.png"));
    assert.ok(meta.some(item => item.name === "twitter:card" && item.content === "summary_large_image"));
    const links = tags(html, "link");
    assert.ok(links.some(item => item.rel === "canonical" && new URL(item.href).href === `https://atlas-peyma.ir${route}`));
    for (const language of ["fa", "en", "x-default"]) assert.ok(links.some(item => item.rel === "alternate" && item.hrefLang === language || item.rel === "alternate" && item.hreflang === language));
    const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    assert.ok(json, "Structured data is server-rendered");
    assert.equal(JSON.parse(json[1])["@graph"].find(item => item["@type"] === "WebPage").inLanguage, locale);
  }
  const robots = await (await fetch(`${origin}/robots.txt`)).text();
  assert.match(robots, /Allow: \/\n/);
  assert.match(robots, /Sitemap: https:\/\/atlas-peyma\.ir\/sitemap.xml/);
  assert.match(robots, /Disallow: \/workspace/);
  assert.doesNotMatch(robots, /Disallow: \/login|Disallow: \/_next/);
  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
  assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), ["https://atlas-peyma.ir/", "https://atlas-peyma.ir/en"]);
  assert.match(sitemap, /hreflang="en"/);
  for (const route of ["/login", "/auth/update-password", "/workspace", "/workspace/admin", "/demo"]) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
    if (route.startsWith("/workspace")) {
      assert.equal(response.status, 307);
      assert.equal(new URL(response.headers.get("location"), origin).pathname, "/login");
    } else if (response.status === 200) {
      assert.ok(tags(await response.text(), "meta").some(item => item.name === "robots" && item.content.includes("noindex")));
    }
  }
  const image = await fetch(`${origin}/social/atlas-peyma.png`);
  assert.equal(image.status, 200); assert.match(image.headers.get("content-type"), /image\/png/);
  const optimized = await fetch(`${origin}/_next/image?url=%2Fsocial%2Fatlas-peyma.png&w=640&q=75`, { headers: { Accept: "image/webp" } });
  assert.equal(optimized.status, 200);

  chrome = spawn(process.env.ATLAS_CHROME_BIN || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-sandbox", "--disable-background-networking", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
  let chromePort;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { chromePort = (await fs.readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0].trim(); break; } catch { await delay(100); }
  }
  assert.ok(chromePort, "Chrome started");
  const targets = await (await fetch(`http://127.0.0.1:${chromePort}/json`)).json();
  socket = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  const exceptions = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
    const handler = pending.get(message.id);
    if (handler) { pending.delete(message.id); if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result); }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 30000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(100); }
    throw new Error(`Timed out waiting for ${expression}`);
  };
  await cdp("Runtime.enable"); await cdp("Page.enable"); await cdp("Network.enable");
  await cdp("Emulation.setScriptExecutionDisabled", { value: true });
  await cdp("Page.navigate", { url: `${origin}/` });
  await waitFor("document.querySelector('.public-hero h1') && document.documentElement.lang==='fa'");
  assert.equal(await evaluate("document.querySelector('.public-hero h1').textContent"), "جهان را در بستر زمان و مکان بشناس");
  await cdp("Emulation.setScriptExecutionDisabled", { value: false });
  for (const [route, locale] of [["/", "fa"], ["/en", "en"]]) {
    await cdp("Page.navigate", { url: `${origin}${route}` });
    await waitFor(`document.querySelector('.public-hero') && document.documentElement.lang==='${locale}'`);
    await delay(500);
    assert.ok((await evaluate("document.title")).includes("|"), "Hydration preserves the SEO title");
    for (const width of [1440, 390, 320]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 761 });
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), true);
      assert.equal(await evaluate("document.querySelectorAll('h1').length"), 1);
      assert.equal(await evaluate("document.querySelector('.public-hero .primary-button').getAttribute('href')"), "/login");
      await waitFor("document.querySelector('.public-map-preview').complete && document.querySelector('.public-map-preview').naturalWidth>0");
      await evaluate("(async()=>{await document.fonts.ready;for(let attempt=0;attempt<20;attempt++){try{await document.querySelector('.public-map-preview').decode();break;}catch(error){if(attempt===19)throw error;await new Promise(resolve=>setTimeout(resolve,100));}}await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})()");
      const screenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await fs.writeFile(`outputs/seo-${locale}-${width}.png`, Buffer.from(screenshot.data, "base64"));
    }
  }
  await evaluate("document.querySelector('.public-hero .primary-button').click()");
  await waitFor("location.pathname==='/login' && document.querySelector('.auth-page')");
  assert.equal(await evaluate("document.documentElement.lang"),'en','English landing carries its language into sign in');
  await evaluate("document.querySelector('.auth-page .brand').click()");
  await waitFor("location.pathname==='/en' && document.querySelector('.public-hero')");
  assert.equal(await evaluate("document.documentElement.lang"),'en');
  await evaluate("document.querySelector('.public-header a[hreflang=fa]').click()");
  await waitFor("location.pathname==='/' && document.documentElement.lang==='fa'");
  assert.equal(await evaluate("document.documentElement.dir"), "rtl");
  assert.deepEqual(exceptions, []);
  await cdp("Browser.close");
  console.log("PASS: production SSR without JavaScript, bilingual metadata/cookies/canonicals/hreflang, robots and sitemap, private noindex/auth guards, structured data, image optimization and mobile layouts.");
} finally {
  socket?.close(); chrome?.kill(); server.kill();
}
