import assert from "node:assert/strict";

export async function runHistoricalBordersQA({ cdp, evaluate, waitFor, click, type, navigate, screenshot }) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await navigate('/workspace');
  await waitFor("document.querySelector('.world-map') && document.querySelector('.global-search input')");
  await waitFor("(() => {window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true}));return document.activeElement === document.querySelector('.global-search input');})()");
  if (await evaluate("document.documentElement.lang === 'fa'")) await click('[data-testid=language-switcher]');
  await waitFor("document.documentElement.lang === 'en'");
  await evaluate("localStorage.setItem('atlas-map-tour-v1','done')");
  const setDate = async (year, month = 0) => {
    await evaluate(`(() => {const el=document.querySelector('.timeline-slider input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'${year*12+month}');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await waitFor(`document.querySelector('.map-stage')?.dataset.boundaryDate === '${year}-${String(month+1).padStart(2,'0')}-01'`);
  };
  const searchCountry = async (query, code) => {
    await type('.global-search input', query);
    await waitFor(`document.querySelector('.search-autocomplete a[href="/workspace#country-${code}"]')`);
    await click(`.search-autocomplete a[href="/workspace#country-${code}"]`);
    await waitFor(`document.querySelector('.country-profile')?.dataset.countryProfile === '${code}'`);
  };
  await setDate(1980);
  await waitFor("document.querySelector('.country[data-country=\"hist-ussr\"]') && document.querySelector('.country[data-country=\"hist-yugoslavia\"]') && document.querySelector('.country[data-country=\"hist-czechoslovakia\"]')");
  assert.equal(await evaluate("document.querySelector('.country[data-country=\"643\"],.country[data-country=\"203\"],.country[data-country=\"191\"]') === null"), true);
  await searchCountry('USSR', 'hist-ussr');
  assert.equal(await evaluate("document.querySelector('.country-profile h2').textContent"), 'Soviet Union');
  assert.equal(await evaluate("document.querySelector('.country-profile').dataset.countryYear"), '1980');
  assert.equal(await evaluate("document.querySelector('.country.selected').dataset.country"), 'hist-ussr');
  assert.equal(await evaluate("document.querySelector('.country-flag-portrait img') === null"), true, 'No modern Russian flag is substituted for USSR');
  await screenshot('historical-1980');
  await setDate(1930);
  await waitFor("document.querySelector('.country[data-country=\"hist-czechoslovakia\"]') && document.querySelector('.country[data-country=\"hist-yugoslavia\"]')");
  await setDate(1900);
  await waitFor("document.querySelector('.country[data-country=\"hist-austria-hungary\"]') && !document.querySelector('.country[data-country=\"hist-ussr\"]')");
  await setDate(2025);
  await waitFor("document.querySelector('.map-stage').dataset.boundaryMode === 'current' && !document.querySelector('.map-boundary-status') && document.querySelector('.country[data-country=\"643\"]')");
  assert.equal(await evaluate("document.querySelector('.country-lifetime').textContent.includes('not active')"), true);
  await searchCountry('Czechoslovakia', 'hist-czechoslovakia');
  await waitFor("document.querySelector('.map-stage').dataset.boundaryDate === '1992-12-01' && document.querySelector('.country.selected')?.dataset.country === 'hist-czechoslovakia'");
  await cdp('Page.reload');
  await waitFor("document.querySelector('.country-profile')?.dataset.countryProfile === 'hist-czechoslovakia' && document.querySelector('.country.selected')?.dataset.country === 'hist-czechoslovakia'");
  await searchCountry('Yugoslavia', 'hist-yugoslavia');
  await waitFor("document.querySelector('.map-stage').dataset.boundaryDate === '1992-04-01'");
  await setDate(1980);
  await click('[data-tour=fullscreen]');
  await waitFor("document.querySelector('.map-expanded')");
  await waitFor("(() => {const a=document.querySelector('.map-boundary-status').getBoundingClientRect(),b=document.querySelector('.timeline').getBoundingClientRect();return a.bottom<=innerHeight && a.top>=b.bottom;})()");
  assert.equal(await evaluate("Boolean(document.querySelector('.map-boundary-status a[href*=creativecommons]'))"), true);
  await screenshot('historical-fullscreen');
  await click('[data-tour=fullscreen]');
  await waitFor("!document.querySelector('.map-expanded')");
  await searchCountry('USSR', 'hist-ussr');
  await click('[data-testid=language-switcher]');
  await waitFor("document.querySelector('.country-profile h2')?.textContent === 'اتحاد جماهیر شوروی'");
  assert.equal(await evaluate("document.querySelector('.country-profile').textContent.includes('Soviet Union')"), false);
  for (const [width,height] of [[390,844],[844,390]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3')");
    await evaluate("document.querySelector('.country-profile').scrollIntoView({block:'center',behavior:'instant'})");
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), true);
    await screenshot(`historical-fa-${width}`);
  }
  // Fresh document clears the module cache. A failed source must not silently show modern borders.
  await cdp("Network.setBlockedURLs", { urls: ['*/boundaries/cshapes-2.0.topojson*'] });
  await cdp('Page.reload');
  await waitFor("document.querySelector('.map-boundary-status[role=alert]')");
  assert.equal(await evaluate("document.querySelector('.country[data-country=\"643\"]') === null"), true);
  await cdp("Network.setBlockedURLs", { urls: [] });
  await click('.map-boundary-status button');
  await waitFor("document.querySelector('.country[data-country=\"hist-ussr\"]') && !document.querySelector('.map-boundary-status[role=alert]')");
  await setDate(2025);
  await waitFor("document.querySelector('.map-stage').dataset.boundaryMode === 'current' && !document.querySelector('.map-boundary-status')");
  console.log('PASS: real dated geometry, distinct predecessor/successor identities, historical search/deep-link focus, reload persistence, language/fullscreen/mobile views, current fallback and failed-load recovery.');
}
