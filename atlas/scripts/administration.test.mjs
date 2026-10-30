import test from "node:test";
import assert from "node:assert/strict";
import { canManageAtlas, canManageAdmins, managedCharacterSchema, publicationRequestSchema, characterPayload, adminChangeSchema } from "../lib/administration.ts";

const character = { name: "  Shared explorer  ", title: "A public character", role: "leader", countryCode: "364", lat: 35, lng: 51, imageUrl: "", startYear: null, endYear: null };
test("owner and administrator capabilities stay separate from ordinary users and political roles", () => {
  for (const role of ["user", "admin", "owner", "leader", "", null, undefined]) {
    assert.equal(canManageAtlas(role), role === "owner" || role === "admin");
    assert.equal(canManageAdmins(role), role === "owner");
  }
});
test("shared characters preserve optional dates while rejecting unsafe portraits, coordinates and terms", () => {
  assert.equal(managedCharacterSchema.parse(character).name, "Shared explorer");
  for (const patch of [{ imageUrl: "javascript:alert(1)" }, { imageUrl: "//evil.test/image.png" }, { imageUrl: "data:image/svg+xml;base64,AAAA" }, { lat: Infinity }, { lng: -181 }, { name: " " }, { role: "owner" }, { startYear: 2000, endYear: 1999 }]) assert.equal(managedCharacterSchema.safeParse({ ...character, ...patch }).success, false);
  for (const imageUrl of ["/portraits/example.jpg", "https://example.test/image.png", "data:image/webp;base64,AAAA"]) assert.equal(managedCharacterSchema.safeParse({ ...character, imageUrl }).success, true);
  assert.equal(managedCharacterSchema.safeParse({ ...character, startYear: 1850 }).success, true, "Existing historical records remain editable");
});
test("publication and role payloads cannot supply ownership, moderation state or owner privileges", () => {
  const request = publicationRequestSchema.parse({ localId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", userId: "forged", status: "approved", character: { ...character, dataset_id: "forged", user_id: "forged", status: "approved" } });
  assert.equal(request.userId, undefined); assert.equal(request.status, undefined);
  const payload = characterPayload(request.character);
  assert.equal(payload.country_code, "364"); assert.equal(payload.name, "Shared explorer");
  for (const forbidden of ["id", "dataset_id", "user_id", "status", "reviewer_id"]) assert.equal(Object.hasOwn(payload, forbidden), false);
  assert.equal(publicationRequestSchema.safeParse({ ...request, localId: "custom:not-a-uuid" }).success, false);
  assert.deepEqual(adminChangeSchema.parse({ userId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", makeAdmin: true, role: "owner" }), { userId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", makeAdmin: true });
});
