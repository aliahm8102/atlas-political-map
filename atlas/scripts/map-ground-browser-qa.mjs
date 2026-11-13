import assert from "node:assert/strict";
import fs from "node:fs";
import { geoNaturalEarth1 } from "d3-geo";
import { feature } from "topojson-client";

const world = JSON.parse(fs.readFileSync(new URL("../data/world.json", import.meta.url)));
const countries = feature(world, world.objects.countries);
const projection = geoNaturalEarth1().fitExtent([[28,45],[972,505]], { ...countries, features: countries.features.filter(item => item.properties?.name !== "Antarctica") });

export async function runMapGroundQA({ cdp, evaluate, waitFor, click, type, screenshot }) {
  const setDate = async year => {
    await evaluate(`(() => {const el=document.querySelector('.timeline-slider input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'${year*12}');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await waitFor(`document.querySelector('.map-stage')?.dataset.boundaryDate === '${year}-01-01'`);
    if (year < 2020) await waitFor("document.querySelector('.country') && !document.querySelector('.map-boundary-status[role=alert]')");
  };
  const point = async coordinate => {
    const projected = projection(coordinate);
    return evaluate(`(() => {const p=new DOMPoint(${projected[0]},${projected[1]}).matrixTransform(document.querySelector('.world-map > g').getScreenCTM());return {x:p.x,y:p.y};})()`);
  };
  const tap = async (coordinate, touch = false) => {
    const p = await point(coordinate);
    assert.equal(await evaluate(`document.elementFromPoint(${p.x},${p.y})?.closest('[data-country]') == null`), true, 'Test point is outside all political country paths');
    if (touch) {
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
      await cdp('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{...p,id:1,radiusX:5,radiusY:5}] });
      await cdp('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    } else {
      await cdp('Input.dispatchMouseEvent', { type:'mousePressed', ...p, button:'left', buttons:1, clickCount:1 });
      await cdp('Input.dispatchMouseEvent', { type:'mouseReleased', ...p, button:'left', buttons:0, clickCount:1 });
    }
    await waitFor("!document.querySelector('.country-profile') && !document.querySelector('.person-spotlight') && document.querySelector('.inspector-heading h2')?.textContent === 'Map controls'");
    assert.equal(await evaluate("document.querySelector('.map-pin.selected-person') === null && location.hash === ''"), true);
  };
  assert.equal(await evaluate("Number(document.querySelector('.timeline-slider input').min)"), 1886*12);
  await type('.global-search input', 'Iran 1886');
  await waitFor("document.querySelector('.search-autocomplete a[href=\"/workspace#country-364\"]')");
  await click('.search-autocomplete a[href="/workspace#country-364"]');
  await waitFor("document.querySelector('.country-profile')?.dataset.countryYear === '1886'");
  await click('button[aria-label="Reset map position"]');
  await evaluate("document.querySelector('.map-stage').scrollIntoView({block:'center',behavior:'instant'})");
  for (const year of [1886,1900,1980,2025]) {
    await setDate(year);
    for (const [coordinate, land] of [[[45,22],true],[[44,23],true],[[38,20],false],[[51,26],false]]) {
      const [x,y] = projection(coordinate);
      assert.equal(await evaluate(`document.querySelector('.country-coastline').isPointInFill(new DOMPoint(${x},${y}))`), land, `${year}: Arabia remains land while Red Sea/Persian Gulf remain water`);
    }
    assert.equal(await evaluate("(() => {const land=document.querySelector('.country-coastline'),country=document.querySelector('.country');return Boolean(land.compareDocumentPosition(country)&Node.DOCUMENT_POSITION_FOLLOWING) && getComputedStyle(land).fill !== getComputedStyle(document.querySelector('.map-stage')).backgroundColor;})()"), true);
  }
  await setDate(1886);
  const landPoint = await point([45,22]);
  assert.equal(await evaluate(`document.elementFromPoint(${landPoint.x},${landPoint.y})?.classList.contains('country-coastline')`), true, 'Unassigned Arabian land is painted without an invented country');
  await screenshot('map-ground-1886');
  await tap([45,22]);
  await setDate(2025);
  await click('.map-pin');
  await waitFor("document.querySelector('.person-spotlight')");
  const ocean = await point([10,-20]);
  await cdp('Input.dispatchMouseEvent', { type:'mousePressed', ...ocean, button:'left', buttons:1, clickCount:1 });
  await cdp('Input.dispatchMouseEvent', { type:'mouseMoved', x:ocean.x+20, y:ocean.y+10, button:'left', buttons:1 });
  await cdp('Input.dispatchMouseEvent', { type:'mouseReleased', x:ocean.x+20, y:ocean.y+10, button:'left', buttons:0, clickCount:1 });
  assert.equal(await evaluate("Boolean(document.querySelector('.person-spotlight'))"), true, 'Panning does not dismiss the selected profile');
  await tap([10,-20]);
  await click('.map-pin');
  await waitFor("document.querySelector('.person-spotlight')");
  await click('[data-tour=fullscreen]');
  await waitFor("document.querySelector('.map-expanded')");
  await click('.map-controls button[aria-label="Map controls"]');
  await waitFor("document.querySelector('.map-inspector-hidden')");
  await tap([10,-20], true);
  await waitFor("!document.querySelector('.map-inspector-hidden')");
  await click('[data-tour=fullscreen]');
  await waitFor("!document.querySelector('.map-expanded')");
  console.log('PASS: 1886 timeline/search, stable land and sea across years, unassigned-land/ocean deselection, preserved pan selection and fullscreen touch return to controls.');
}
