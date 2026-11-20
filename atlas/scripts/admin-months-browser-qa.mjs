import assert from "node:assert/strict";

export async function runAdminMonthsQA({ evaluate, cdp, click, input, waitFor, navigate, screenshot, fixtureOrigin }) {
  await navigate(`${fixtureOrigin}?fixture=admin-months`);
  await waitFor("document.querySelector('#admin-tab-characters') && !document.querySelector('.admin-toolbar button').disabled");
  await click('#admin-tab-characters');
  const edit = async () => {
    await click('.admin-person .secondary-button');
    await waitFor("document.querySelector('[name=admin-start-month]')");
  };
  const month = (term, value) => evaluate(`(() => {const el=document.querySelector('[name=admin-${term}-month]');el.value='${value}';el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const read = () => evaluate("JSON.parse(document.querySelector('#test-admin-people').textContent)");
  const save = async () => {
    await click('.admin-editor button[type=submit]');
    await waitFor("!document.querySelector('.admin-editor') && !document.querySelector('.admin-toolbar button').disabled");
  };
  await edit();
  assert.deepEqual(await evaluate("['start','end'].map(term=>[document.querySelector('[name=admin-'+term+']').value,document.querySelector('[name=admin-'+term+'-month]').value])"), [['2025','2'],['2025','5']]);
  assert.equal(await evaluate("document.querySelector('[name=admin-start-month]').selectedOptions[0].textContent"), 'March');
  // Submitting without edits must preserve the existing monthly payload exactly.
  await save();
  assert.equal((await read())[0].startYear,2025+2/12);
  assert.equal((await read())[0].endYear,2025+5/12);
  await edit();
  await month('start',8); await month('end',7);
  await click('.admin-editor button[type=submit]');
  await waitFor("document.querySelector('.admin-editor .form-error')");
  assert.equal((await read())[0].startYear,2025+2/12,'Reversed monthly dates must not be saved');
  await month('start',3); await month('end',6);
  await save(); await edit();
  assert.equal((await read()).length,1);
  assert.equal((await read())[0].id,'monthly-admin-fixture');
  assert.equal((await read())[0].startYear,2025+3/12);
  assert.equal((await read())[0].endYear,2025+6/12);
  assert.equal(await evaluate("document.querySelector('[name=admin-start-month]').value"),'3');
  assert.equal(await evaluate("document.querySelector('[name=admin-end-month]').value"),'6');
  await click('[data-testid=language-switcher]');
  await waitFor("document.querySelector('[name=admin-start-month]').selectedOptions[0].textContent.includes('آوریل')");
  await month('start',8); await month('end',10);
  for (const width of [320,390]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate("document.querySelector('.atlas-app').style.setProperty('--font-scale','1.3');document.querySelector('.character-term').scrollIntoView({block:'start',behavior:'instant'})");
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.character-term')).borderTopWidth"),'1px');
    await screenshot(`admin-months-fa-${width}`);
  }
  await save(); await edit();
  assert.equal(await evaluate("document.querySelector('[name=admin-start-month]').value"),'8');
  assert.equal(await evaluate("document.querySelector('[name=admin-end-month]').value"),'10');
  // Clearing a year keeps its month selectable and persists an open boundary.
  await input('[name=admin-end]','');
  assert.equal(await evaluate("document.querySelector('[name=admin-end-month]').disabled"),false);
  await month('end', 9);
  await save();
  assert.equal((await read())[0].endYear,null);
  // Existing pre-timeline records remain editable; whole years reopen as January.
  await edit(); await input('[name=admin-start]','1850'); await month('start',0);
  await save(); await edit();
  assert.equal(await evaluate("document.querySelector('[name=admin-start]').value"),'1850');
  assert.equal(await evaluate("document.querySelector('[name=admin-start-month]').value"),'0');
  await click('.admin-editor .icon-button');
  await click('#admin-tab-content > .admin-toolbar .primary-button');
  await waitFor("document.querySelector('[name=admin-name]')?.value===''");
  assert.equal(await evaluate("!document.querySelector('[name=admin-start-month]').disabled && !document.querySelector('[name=admin-end-month]').disabled"),true);
  await input('[name=admin-name]','New monthly character'); await input('[name=admin-title]','Monthly office');
  await month('start',11); await month('end',1);
  await input('[name=admin-start]','2025');
  await input('[name=admin-end]','2026');
  await save();
  assert.equal((await read()).length,2);
  assert.equal((await read())[1].startYear,2025+11/12);
  assert.equal((await read())[1].endYear,2026+1/12);
  console.log('PASS: administration monthly edit/create, unchanged-date roundtrip, same-year validation, database payload serialization, reopen, optional dates, legacy years and Persian mobile layouts.');
}
