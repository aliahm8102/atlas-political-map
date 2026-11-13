import assert from "node:assert/strict";

export async function runCountrySearchQA({ cdp, evaluate, waitFor, click, type, navigate, screenshot }) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await navigate('/workspace');
  await waitFor("document.querySelector('.global-search input') && document.querySelector('.world-map')");
  await waitFor("(() => { window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true})); return document.activeElement === document.querySelector('.global-search input'); })()");
  if (await evaluate("document.documentElement.lang === 'fa'")) await click('[data-testid=language-switcher]');
  await waitFor("document.documentElement.lang === 'en'");
  await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  const input = '.global-search input';
  const setYear = async year => {
    await evaluate(`(() => { const slider=document.querySelector('.timeline-slider input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(slider,${JSON.stringify(String(year * 12))}); slider.dispatchEvent(new Event('input',{bubbles:true})); slider.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await waitFor(`document.querySelector('.country-profile')?.dataset.countryYear === '${year}'`);
  };
  await type(input, 'United');
  await waitFor("document.querySelector('[data-preview-type=place] [role=option]')");
  assert.equal(await evaluate("document.querySelectorAll('[data-preview-type=place] [role=option]').length"), 3, 'Country preview is capped at three');
  assert.equal(await evaluate("[...document.querySelectorAll('[data-preview-type]')].every(section => section.querySelectorAll('[role=option]').length <= 3)"), true);
  await type(input, 'Germany');
  await waitFor("document.querySelector('[data-preview-type=place] a')?.getAttribute('href') === '/workspace#country-276'");
  await evaluate("window.scrollTo(0,document.documentElement.scrollHeight)");
  await click('[data-preview-type=place] a');
  await waitFor("location.hash === '#country-276' && document.querySelector('[data-country-profile=\"276\"]') && document.querySelector('#country-276')");
  await waitFor("(() => { const r = document.querySelector('#country-276').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight / 2; })()");
  assert.match(await evaluate("document.querySelector('.world-map > g').getAttribute('transform')"), /scale\(2\.7\)/);
  assert.equal(await evaluate("document.querySelector('.country.selected').dataset.country"), '276');
  await setYear(2025);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.country-facts dd')].map(el => el.textContent)"), ['Berlin', '357,022', '83,491,249']);
  assert.equal(await evaluate("document.querySelectorAll('.country-profile h2').length === 1 && !document.querySelector('.country-profile').textContent.includes('آلمان') && !document.querySelector('.country-english-name')"), true, 'English country identity uses one English name');
  await waitFor("document.querySelector('.country-flag-portrait img').complete && document.querySelector('.country-flag-portrait img').naturalWidth > 0");
  await screenshot('country-profile-germany');
  await cdp('Page.reload');
  await waitFor("document.querySelector('[data-country-profile=\"276\"]') && location.hash === '#country-276'");
  await navigate('/workspace#country-020');
  await waitFor("document.querySelector('.country-heading h2')?.textContent === 'Andorra'");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.country-facts dd')].map(el => el.textContent)"), ['Andorra la Vella', '468', '82,904']);
  await type(input, 'Vatican');
  await waitFor("document.querySelector('[data-preview-type=place] a')");
  await click('[data-preview-type=place] a');
  await waitFor("document.querySelector('[data-country-profile=\"336\"]')");
  assert.equal(await evaluate("document.querySelectorAll('.country-facts dd')[1].textContent"), '0.49');
  await evaluate("[...document.querySelectorAll('nav button')].find(el => el.textContent.includes('People directory')).click()");
  await waitFor("document.querySelector('.person-card')");
  const personId = await evaluate("document.querySelector('.person-card').dataset.personId");
  for (let i = 1; i <= 4; i++) {
    await type('#directory-group-name', `Atlas group ${i}`);
    await click('.group-form button[type=submit]');
    await waitFor(`document.querySelector('[aria-label="Filter by group"]').options.length === ${i+1}`);
  }
  await click('.person-card .person-organization-actions button');
  await type('[name=person-tags]', 'Atlas tag 1, Atlas tag 2, Atlas tag 3, Atlas tag 4');
  await evaluate("document.querySelectorAll('.group-memberships input').forEach(el => el.click())");
  await click('.modal-inner button[type=submit]');
  await waitFor("!document.querySelector('[name=person-tags]')");
  await type(input, 'Atlas');
  await waitFor("document.querySelectorAll('[data-preview-type=tag] [role=option]').length === 3 && document.querySelectorAll('[data-preview-type=group] [role=option]').length === 3");
  await screenshot('search-preview-groups');
  await click('[data-preview-type=tag] a');
  await waitFor("document.querySelectorAll('.search-result-card').length === 1 && new URLSearchParams(location.search).has('tag')");
  assert.equal(await evaluate("document.querySelector('.search-result-card').dataset.searchResult"), `person:${personId}`);
  await type(input, 'Atlas');
  await waitFor("document.querySelector('[data-preview-type=group] a')");
  await click('[data-preview-type=group] a');
  await waitFor("document.querySelectorAll('.search-result-card').length === 1 && new URLSearchParams(location.search).has('group')");
  await click('.search-result-card a');
  await waitFor(`location.hash === ${JSON.stringify('#person-' + encodeURIComponent(personId))} && document.querySelector('.map-pin.selected-person')?.dataset.personId === ${JSON.stringify(personId)}`);
  await cdp('Page.reload');
  await waitFor(`document.querySelector('.map-pin.selected-person')?.dataset.personId === ${JSON.stringify(personId)}`);
  await navigate('/workspace#country-276');
  await waitFor("document.querySelector('[data-country-profile=\"276\"]')");
  await setYear(2025);
  await click('[data-testid=language-switcher]');
  await waitFor("document.querySelector('.country-facts dd')?.textContent === 'برلین'");
  assert.equal(await evaluate("document.querySelector('.country-profile h2').textContent === 'آلمان' && !document.querySelector('.country-profile').textContent.includes('Germany') && !document.querySelector('.country-english-name')"), true, 'Persian country identity contains no extra English country name');
  for (const year of [2024, 2026, 1900]) {
    await setYear(year);
    assert.equal(await evaluate("[...document.querySelectorAll('.country-facts dd')].every(el => el.textContent === 'موجود نیست') && !document.querySelector('.country-flag-portrait img') && document.querySelector('.country-profile').dataset.countryDataYear === ''"), true, 'Unfilled years never reuse 2025 facts or a modern flag');
    assert.equal(await evaluate(`document.querySelector('.country-reference-note').textContent.includes(new Intl.NumberFormat('fa-IR',{useGrouping:false}).format(${year}))`), true);
  }
  await setYear(2025);
  await waitFor("document.querySelector('.country-flag-portrait img')?.complete && document.querySelector('.country-flag-portrait img').naturalWidth > 0");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.country-facts dd')].map(el => el.textContent)"), ['برلین', '۳۵۷٬۰۲۲', '۸۳٬۴۹۱٬۲۴۹']);
  await click('[data-testid=language-switcher]');
  await waitFor("document.querySelector('.country-profile h2')?.textContent === 'Germany' && document.querySelector('.country-facts dd')?.textContent === 'Berlin'");
  await click('[data-testid=language-switcher]');
  await waitFor("document.querySelector('.country-profile h2')?.textContent === 'آلمان'");
  for (const [width, height] of [[390,844],[844,390]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3')");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true, 'Country profiles fit mobile RTL');
    await type(input, 'ایران');
    await waitFor("document.querySelector('[data-preview-type=place] a')");
    assert.equal(await evaluate("(() => { const r = document.querySelector('.search-autocomplete').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })()"), true);
    await screenshot(`country-search-fa-${width}`);
    await click('[data-preview-type=place] a');
    await waitFor("document.querySelector('[data-country-profile=\"364\"]')");
    await evaluate("document.querySelector('.country-profile').scrollIntoView({block:'center',behavior:'instant'})");
    await screenshot(`country-profile-fa-${width}`);
  }
  console.log('PASS: per-type previews, map anchors, annual facts/flags and missing-year recovery, one-language country names, reload persistence and RTL/mobile profiles.');
}
