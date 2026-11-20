import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { landingMetadata, landingContent, publicLanguages, publicStructuredData, SITE_URL } from "../lib/seo.ts";

test("public locales have self-canonicals, reciprocal alternates and matching visible/social/structured content", () => {
  for (const locale of ["fa", "en"]) {
    const metadata = landingMetadata(locale), copy = landingContent[locale];
    assert.equal(metadata.alternates.canonical, publicLanguages[locale]);
    assert.deepEqual(metadata.alternates.languages, publicLanguages);
    assert.equal(metadata.robots.index, true);
    assert.equal(metadata.robots.follow, true);
    for (const social of [metadata.openGraph, metadata.twitter]) {
      assert.equal(social.description, copy.description);
      assert.equal(social.title, copy.title);
      assert.equal(social.images[0].url, `${SITE_URL}/social/atlas-peyma.png`);
    }
    const graph = JSON.parse(JSON.stringify(publicStructuredData(locale)))["@graph"];
    assert.deepEqual(graph.map(item => item["@type"]), ["WebSite", "WebPage", "WebApplication"]);
    assert.equal(graph[1].url, publicLanguages[locale]);
    assert.equal(graph[1].inLanguage, locale);
    assert.equal(graph[1].description, copy.description);
    assert.equal(graph[2].description, copy.description);
    assert.equal(graph[2].offers, undefined, "No invented prices or ratings");
  }
});

test("the share image is a real 1200 by 630 PNG", async () => {
  const image = await fs.readFile(new URL("../public/social/atlas-peyma.png", import.meta.url));
  assert.equal(image.subarray(1, 4).toString(), "PNG");
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});
