// Select through the actual themed picker rather than changing a hidden/native input.
export async function selectMonthQA({ evaluate, click, waitFor }, selector, value) {
  await click(selector);
  await waitFor("document.querySelector('.month-picker-panel')");
  if (!value) await click('.month-picker-footer button:first-child');
  else {
    await evaluate(`(()=>{const input=document.querySelector('.month-picker-year input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value.slice(0,4))});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await click(`[data-month-option="${value}"]`);
  }
  await waitFor("!document.querySelector('.month-picker-panel')");
}
