import test from "node:test";
import assert from "node:assert/strict";
import { feedbackSchema, feedbackStatusSchema } from "../lib/feedback.ts";

test("feedback accepts bounded text and strips client-supplied ownership and status", () => {
  const message = feedbackSchema.parse({ category: "bug", subject: "  مشکل نقشه  ", body: "  جزئیات مشکل  ", userId: "other-account", status: "resolved", senderEmail: "forged" });
  assert.deepEqual(message, { category: "bug", subject: "مشکل نقشه", body: "جزئیات مشکل" });
  for (const patch of [{ category: "admin" }, { subject: "  " }, { body: "\n\t" }, { subject: "x".repeat(121) }, { body: "x".repeat(4001) }]) assert.equal(feedbackSchema.safeParse({ ...message, ...patch }).success, false);
  for (const category of ["bug", "suggestion", "contact"]) assert.equal(feedbackSchema.safeParse({ ...message, category }).success, true);
  assert.equal(feedbackStatusSchema.safeParse("approved").success, false);
});
