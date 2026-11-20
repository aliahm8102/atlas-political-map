import test from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, customAccentStyle, DEFAULT_CUSTOM_ACCENT, hexToRgb, rgbToHex } from "../lib/accent-colors.ts";
import { defaultSettings, localStateSchema, settingsSchema } from "../lib/atlas.ts";

test("custom RGB values round trip exactly and reject invalid channels or unsafe persisted CSS",()=>{
  for(const rgb of [[0,0,0],[255,255,255],[211,92,55],[1,2,3],[128,255,0]]) assert.deepEqual(hexToRgb(rgbToHex(rgb)),rgb);
  assert.deepEqual(hexToRgb("#D35C37"),[211,92,55]);
  for(const rgb of [[-1,0,0],[256,0,0],[0,1.5,0],[0,NaN,0]]) assert.throws(()=>rgbToHex(rgb),RangeError);
  for(const customAccent of ["red","#fff","#11223344","url(https://example.test)","#ffffff; color:red",null,12]) assert.equal(settingsSchema.safeParse({accent:"custom",customAccent}).success,false);
});
test("legacy settings keep their default custom colour and chosen RGB survives local/remote JSON and preset switches",()=>{
  assert.equal(settingsSchema.parse({accent:"rose"}).customAccent,DEFAULT_CUSTOM_ACCENT);
  const settings=settingsSchema.parse({...defaultSettings,accent:"custom",customAccent:"#d35c37"});
  assert.deepEqual(localStateSchema.parse(JSON.parse(JSON.stringify({settings}))).settings,settings);
  assert.equal(settingsSchema.parse({...settings,accent:"blue"}).customAccent,"#d35c37");
  assert.equal(settingsSchema.parse({...defaultSettings}).customAccent,DEFAULT_CUSTOM_ACCENT);
  assert.deepEqual(customAccentStyle({...settings,accent:"sage"}),{});
});
test("custom palettes remain readable in every theme, including black, white and saturated colours",()=>{
  const backgrounds={light:["#e9eeeb","#edf1ee","#e4eae5"],sand:["#efe9df","#f6f0e6","#e9e0d1"],dark:["#232e28","#29362e","#253329"],midnight:["#1c2534","#253144","#202c3d"]};
  for(const [theme,surfaces] of Object.entries(backgrounds)) for(const customAccent of ["#000000","#ffffff","#ff0000","#00ff00","#0000ff","#ffff00","#808080","#d35c37"]) {
    const palette=customAccentStyle({accent:"custom",customAccent,theme});
    for(const color of Object.values(palette)) assert.match(color,/^#[0-9a-f]{6}$/);
    for(const surface of [...surfaces,palette['--accent-soft']]) {
      assert.ok(contrastRatio(palette['--accent'],surface)>=4.5,`${theme}/${customAccent}: accent readable on ${surface}`);
      assert.ok(contrastRatio(palette['--accent-dark'],surface)>=4.5);
    }
    assert.ok(contrastRatio(palette['--accent'],palette['--on-accent'])>=4.5);
    assert.ok(contrastRatio(palette['--accent-dark'],palette['--on-accent'])>=4.5);
  }
});
