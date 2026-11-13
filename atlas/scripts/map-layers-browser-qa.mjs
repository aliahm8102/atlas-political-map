import assert from "node:assert/strict";

// Serve deterministic tiles through CDP: no bulk traffic to public providers.
// Provider availability is checked separately with one real tile per source.
export async function runMapLayersQA({ evaluate, cdp, click, waitFor, navigate, screenshot, fixtureOrigin, tileRequests, setTileFailure }) {
  await cdp("Fetch.enable", { patterns: [
    { urlPattern: "https://server.arcgisonline.com/*/tile/*" },
    { urlPattern: "https://tile.opentopomap.org/*" },
    { urlPattern: "https://tile.openstreetmap.org/*" },
  ] });
  await navigate(fixtureOrigin);
  await waitFor("document.querySelector('.world-map') && document.querySelector('.map-pin')");
  await cdp("Page.bringToFront");
  await evaluate("localStorage.setItem('atlas-map-tour-v1','done')");
  assert.equal(await evaluate("Boolean(document.querySelector('.leaflet-basemap'))"), false, "Bundled SVG remains the default; Leaflet tiles are opt-in");
  const choose = async (type, expectFailure = false) => {
    const selector = await evaluate("document.querySelector('.map-expanded') ? '.map-controls .map-type-trigger' : '.map-subbar .map-type-trigger'");
    // Next can show server-rendered controls before hydration finishes.
    await waitFor(`(() => { if (document.querySelector('.map-type-options')) return true; document.querySelector(${JSON.stringify(selector)})?.click(); return false; })()`);
    await click(`[data-map-type="${type}"]`);
    try {
      const needle = { physical: "World_Physical_Map", topographic: "tile.opentopomap.org", satellite: "World_Imagery", political: "tile.openstreetmap.org" }[type];
      await waitFor(type === "default" ? "!document.querySelector('.leaflet-basemap')" : `document.querySelector('.leaflet-basemap')?.dataset.basemap === '${type}' && ${expectFailure ? "document.querySelector('.map-load-status[role=alert]')" : `document.querySelector('.leaflet-tile-loaded[src*="${needle}"]')`}`);
    } catch (error) {
      console.error("Tile diagnostics", { requests: tileRequests.slice(-3), images: await evaluate("[...document.querySelectorAll('.leaflet-tile')].slice(0,3).map(img=>({src:img.src,complete:img.complete,width:img.naturalWidth}))") });
      throw error;
    }
  };
  const transform = () => evaluate("document.querySelector('.world-map > g').getAttribute('transform')");
  for (const [type, url, attribution] of [
    ["physical", "World_Physical_Map/MapServer/tile/", "US National Park Service"],
    ["topographic", "tile.opentopomap.org/", "OpenTopoMap"],
    ["satellite", "World_Imagery/MapServer/tile/", "Vantor"],
    ["political", "tile.openstreetmap.org/", "OpenStreetMap"],
  ]) {
    await choose(type);
    await waitFor(`document.querySelector('.map-attribution').textContent.includes('${attribution}')`);
    assert.ok(tileRequests.some(request => request.includes(url)), `${type}: requested the selected source`);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.country:not(.selected)')).fill"), "rgba(0, 0, 0, 0)", "Country overlays do not obscure the geographic imagery");
    const before = await transform();
    await click('button[aria-label="Zoom in"]');
    await waitFor(`document.querySelector('.world-map > g').getAttribute('transform') !== ${JSON.stringify(before)}`);
    // Compare SVG geography with an independently positioned Leaflet tile at fractional zoom.
    assert.equal(await evaluate(`(() => {
      const tile=document.querySelector('.leaflet-tile-loaded'), rect=tile.getBoundingClientRect();
      const parts=new URL(tile.src).pathname.replace('.png','').split('/').slice(-3).map(Number);
      const [z,x,y]=tile.src.includes('arcgisonline') ? [parts[0],parts[2],parts[1]] : parts;
      const origin=new DOMPoint(500,270).matrixTransform(document.querySelector('.world-map > g').getScreenCTM());
      return Math.hypot(origin.x-(rect.left+(2**z/2-x)*rect.width),origin.y-(rect.top+(2**z/2-y)*rect.height)) < 2;
    })()`), true);
  }
  if (await evaluate("Boolean(document.querySelector('#test-focus-country'))")) {
    await click('#test-focus-country');
    await waitFor("document.querySelector('.country.selected')?.dataset.country === '276'");
    await waitFor(`(() => {
      const point=[(13.4+180)/360*1000,270-Math.log(Math.tan(Math.PI/4+52.5*Math.PI/360))*1000/(2*Math.PI)];
      const screen=new DOMPoint(...point).matrixTransform(document.querySelector('.world-map > g').getScreenCTM());
      const rect=document.querySelector('.map-stage').getBoundingClientRect();
      return Math.hypot(screen.x-rect.left-rect.width/2,screen.y-rect.top-rect.height/2)<2;
    })()`);
  }
  await choose("topographic");
  for (let i = 0; i < 22; i++) await click('button[aria-label="Zoom in"]');
  assert.ok(await evaluate("Number(document.querySelector('.world-map > g').getAttribute('transform').match(/scale\\(([^)]+)/)[1]) > 64"), "Geographic maps can zoom to city/contour detail beyond the original 64× cap");
  await choose("physical");
  await waitFor("document.querySelector('button[aria-label=\"Zoom in\"]').disabled");
  const physicalRequests = tileRequests.filter(url => url.includes("World_Physical_Map/MapServer/tile/"));
  assert.ok(physicalRequests.every(url => Number(url.split("/tile/")[1].split("/")[0]) <= 8), "Physical source never requests unsupported zoom levels");
  await click('button[aria-label="Reset map position"]');
  const pin = await evaluate("document.querySelector('.map-pin').dataset.personId");
  await click(`.map-pin[data-person-id="${pin}"]`);
  await waitFor(`document.querySelector('.map-pin[data-person-id="${pin}"]').getAttribute('aria-pressed') === 'true'`);
  await evaluate(`document.querySelector('.map-pin[data-person-id="${pin}"]').focus({preventScroll:true})`);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
  const savedPosition = `Object.keys(localStorage).filter(key=>key.startsWith('atlas-people-v1:')).map(key=>JSON.parse(localStorage.getItem(key)).positions[${JSON.stringify(pin)}]).find(Boolean)`;
  await waitFor(savedPosition);
  const originalPosition = await evaluate(savedPosition);
  await click('button[aria-label="Enter fullscreen"]');
  await waitFor("document.querySelector('.map-expanded')");
  await choose("satellite");
  assert.ok(await evaluate("Boolean(document.querySelector('.map-pin.selected-person'))"), "Selected portrait stays above the tiles after switching");
  await waitFor("(() => {const a=document.querySelector('.map-attribution').getBoundingClientRect(),timeline=document.querySelector('.timeline').getBoundingClientRect();return a.bottom<=innerHeight && a.top>=timeline.bottom;})()");
  await click('button[aria-label="Drawing tools"]');
  const point = await evaluate("(() => { const r=document.querySelector('.map-stage').getBoundingClientRect(); return {x:r.left+r.width*.4,y:r.top+r.height*.4}; })()");
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", buttons: 1, clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x + 70, y: point.y + 20, button: "left", buttons: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x + 70, y: point.y + 20, button: "left", buttons: 0, clickCount: 1 });
  await waitFor("document.querySelector('[data-pencil-stroke]')");
  await choose("political");
  assert.equal(await evaluate("document.querySelectorAll('[data-pencil-stroke]').length"), 1, "Drawing survives switching between tile sources");
  await click('button[aria-label="Drawing tools"]');
  await click('button[aria-label="Red laser pointer"]');
  await waitFor("document.querySelector('.map-laser-active')");
  await screenshot("atlas-leaflet-fullscreen");
  await click('button[aria-label="Exit fullscreen"]');
  await waitFor("!document.querySelector('.map-expanded')");

  setTileFailure(true);
  await choose("satellite", true);
  await waitFor("document.querySelector('.map-load-status[role=alert]')");
  setTileFailure(false);
  await click('.map-load-status button');
  await waitFor("document.querySelector('.leaflet-tile-loaded') && !document.querySelector('.map-load-status[role=alert]')");
  await choose("default");
  assert.equal(await evaluate(`(() => {const matrix=document.querySelector('.map-pin[data-person-id="${pin}"]').closest('g').transform.baseVal.getItem(0).matrix;return Math.abs(matrix.e-${originalPosition.x})<.001 && Math.abs(matrix.f-${originalPosition.y})<.001;})()`), true, "Moving a portrait on Leaflet stores positions in the original projection and survives returning to the default map");
  for (const [width, height] of [[320, 640], [844, 390]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await cdp("Network.setCookie", { name: "atlas-locale", value: "fa", url: fixtureOrigin });
    await navigate(`${fixtureOrigin}?locale=fa`);
    await waitFor("document.querySelector('.map-type-trigger')");
    await choose("topographic");
    await evaluate("void Object.defineProperty(document.querySelector('.map-experience'),'requestFullscreen',{configurable:true,value:undefined})");
    await click('[data-tour="fullscreen"]');
    await waitFor("document.querySelector('.map-expanded')");
    await click('.map-controls .map-type-trigger');
    assert.equal(await evaluate("(() => { const r=document.querySelector('.map-controls .map-type-options').getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight && document.documentElement.scrollWidth<=innerWidth; })()"), true, "Persian fullscreen picker fits phone and landscape screens");
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape" });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape" });
    await waitFor("!document.querySelector('.map-type-options') && document.querySelector('.map-expanded')");
    await click('.map-controls .map-type-trigger');
    await screenshot(`atlas-leaflet-fa-${width}`);
    await click('[data-map-type="default"]');
    await waitFor("!document.querySelector('.leaflet-basemap')");
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape" });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape" });
  }
  await cdp("Fetch.disable");
  console.log("PASS: default SVG, all four Leaflet sources, attribution, native zoom limits, selection, fullscreen, drawing, laser, error recovery and Persian mobile/landscape picker.");
}
