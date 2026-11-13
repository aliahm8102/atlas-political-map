import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

export async function runCharacterMonthsQA({ evaluate, cdp, click, input, waitFor, navigate, screenshot, fixtureOrigin, fileChoosers }) {
  await navigate(fixtureOrigin);
  await waitFor("document.querySelector('#test-characters')");
  await click('#test-characters');
  await waitFor("document.querySelector('.character-form button[type=submit]:not(:disabled)')");
  const read = () => evaluate("JSON.parse(localStorage.getItem('atlas-people-v1:fixture-a'))");
  const month = (selector, value) => evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});el.value='${value}';el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.equal(await evaluate("document.querySelector('[name=character-start-month]').disabled && document.querySelector('[name=character-end-month]').disabled"), true);
  await input('[name=character-name]', 'Monthly character');
  await input('[name=character-title]', 'A monthly office');
  await input('[name=character-name-fa]', 'شخصیت ماهانه');
  await input('[name=character-title-fa]', 'سمت ماهانه');
  await input('[name=character-start]', '2025');
  await month('[name=character-start-month]', 2);
  await input('[name=character-end]', '2025');
  await month('[name=character-end-month]', 2);
  await click('.character-form button[type=submit]');
  await waitFor("document.querySelector('.form-error')?.textContent.includes('end date')");
  assert.equal(await evaluate("document.querySelectorAll('.custom-character').length"), 0);
  await month('[name=character-end-month]', 5);

  await cdp('Page.setInterceptFileChooserDialog', { enabled: true });
  const choosePortrait = async () => {
    const previous = fileChoosers.length;
    await evaluate("document.querySelector('.portrait-select').focus()");
    await cdp('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, text:'\r' });
    await cdp('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
    for (let i=0;i<30 && fileChoosers.length===previous;i++) await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal(fileChoosers.length,previous+1,'Visible keyboard-accessible portrait button opens the native chooser');
    const { root } = await cdp('DOM.getDocument');
    const { nodeId } = await cdp('DOM.querySelector', { nodeId:root.nodeId, selector:'[name=character-portrait]' });
    await cdp('DOM.setFileInputFiles', { nodeId, files:[fileURLToPath(new URL('../public/portraits/iran/Masoud_Pezeshkian.jpg',import.meta.url))] });
    await waitFor("document.querySelector('.character-portrait-preview img') && !document.querySelector('.portrait-select').disabled");
    assert.match(await evaluate("document.querySelector('.portrait-file-name').textContent"), /Masoud_Pezeshkian/);
  };
  await choosePortrait();
  assert.equal(await evaluate("document.querySelector('.portrait-select').getBoundingClientRect().height>=42"),true);
  await click('.character-form button[type=submit]');
  await waitFor("document.querySelector('.custom-character h3')?.textContent==='Monthly character'");
  const created=(await read()).people[0];
  assert.equal(created.startYear,2025+2/12); assert.equal(created.endYear,2025+5/12);
  assert.match(created.imageUrl,/^data:image\/webp;base64,/);
  assert.equal(await evaluate("document.querySelector('[name=character-start-month]').disabled && document.querySelector('.portrait-file-name').textContent==='No portrait selected'"),true);

  await click('.custom-character > button.icon-button');
  await waitFor("document.querySelector('[name=character-start]').value==='2025' && document.querySelector('[name=character-start-month]').value==='2'");
  assert.equal(await evaluate("document.querySelector('[name=character-end-month]').value"),'5');
  await click('.character-portrait-preview button');
  await waitFor("!document.querySelector('.character-portrait-preview')");
  await choosePortrait();
  await month('[name=character-start-month]',3); await month('[name=character-end-month]',6);
  await click('.character-form button[type=submit]');
  await waitFor("document.querySelector('.form-success')");
  const edited=(await read()).people[0];
  assert.equal(edited.id,created.id); assert.equal((await read()).people.length,1);
  assert.equal(edited.startYear,2025+3/12); assert.equal(edited.endYear,2025+6/12);
  await navigate(fixtureOrigin);
  await waitFor("document.querySelector('#test-characters')");
  await click('#test-characters');
  await waitFor("document.querySelector('.custom-character h3')?.textContent==='Monthly character'");
  await click('.custom-character > button.icon-button');
  await waitFor("document.querySelector('[name=character-start-month]').value==='3' && document.querySelector('[name=character-end-month]').value==='6'");
  await click('[data-testid=language-switcher]');
  await waitFor("document.querySelector('[name=character-start-month]').selectedOptions[0].textContent.includes('آوریل')");
  await month('[name=character-start-month]',8); await month('[name=character-end-month]',10);
  await click('.character-form button[type=submit]');
  await waitFor("document.querySelector('.form-success')");
  assert.equal((await read()).people[0].startYear,2025+8/12);
  await click('.custom-character > button.icon-button');
  await waitFor("document.querySelector('[name=character-start-month]').value==='8'");
  for (const width of [320,390]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3');document.querySelector('.character-term').scrollIntoView({block:'start',behavior:'instant'})");
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
    assert.equal(await evaluate("document.querySelector('.portrait-select').textContent.includes('تغییر تصویر')"),true);
    await screenshot(`character-months-fa-${width}`);
  }
  await cdp('Page.setInterceptFileChooserDialog',{enabled:false});
  console.log('PASS: month-specific creation/editing, reversed-date validation, local persistence/reload, keyboard portrait chooser, image replacement/reselection and Persian mobile layouts.');
}
