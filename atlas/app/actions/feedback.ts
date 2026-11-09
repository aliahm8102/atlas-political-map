"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { localAuthConfig } from "@/lib/auth/local";
import { feedbackSchema, feedbackStatusSchema, type FeedbackError, type FeedbackMessage, type FeedbackResult, type FeedbackStatus } from "@/lib/feedback";

class FeedbackFailure extends Error {
  constructor(readonly key: FeedbackError) { super(key); }
}
function check(error: { code?: string } | null) {
  if (!error) return;
  if (["PGRST202", "42883", "42P01"].includes(error.code ?? "")) throw new FeedbackFailure("Feedback is not enabled yet.");
  if (error.code === "42501") throw new FeedbackFailure("You do not have permission to manage Atlas.");
  if (["22023", "22P02", "23514"].includes(error.code ?? "")) throw new FeedbackFailure("Check the message details and try again.");
  if (error.code === "P0001") throw new FeedbackFailure("Too many messages. Try again later.");
  throw new FeedbackFailure("The request could not be saved. Refresh and try again.");
}
async function session() {
  if (localAuthConfig()) throw new FeedbackFailure("Sign in with an online account to contact administrators.");
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new FeedbackFailure("Sign in with an online account to contact administrators.");
  // Every RPC checks the verified actor and current role again in PostgreSQL.
  return client;
}
async function result<T>(work: () => Promise<T>): Promise<FeedbackResult<T>> {
  try { return { ok: true, data: await work() }; }
  catch (error) { return { ok: false, error: error instanceof FeedbackFailure ? error.key : error instanceof z.ZodError ? "Check the message details and try again." : "The request could not be saved. Refresh and try again." }; }
}

export async function sendFeedback(request: unknown): Promise<FeedbackResult<string>> {
  return result(async () => {
    const client = await session(), parsed = feedbackSchema.parse(request);
    const saved = await client.rpc("send_atlas_feedback", { category: parsed.category, subject: parsed.subject, body: parsed.body });
    check(saved.error);
    return String(saved.data);
  });
}
export async function loadFeedback(): Promise<FeedbackResult<FeedbackMessage[]>> {
  return result(async () => {
    const client = await session();
    const loaded = await client.rpc("list_atlas_feedback");
    check(loaded.error);
    return (loaded.data ?? []).map((row: Record<string, unknown>) => ({ id: String(row.id), category: row.category as FeedbackMessage["category"], subject: String(row.subject), body: String(row.body), senderName: String(row.sender_name), senderEmail: String(row.sender_email), status: row.status as FeedbackStatus, createdAt: String(row.created_at) }));
  });
}
export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<FeedbackResult<null>> {
  return result(async () => {
    const client = await session();
    const parsed = z.object({ id: z.string().uuid(), status: feedbackStatusSchema }).parse({ id, status });
    const updated = await client.rpc("set_atlas_feedback_status", { message_id: parsed.id, next_status: parsed.status });
    check(updated.error);
    return null;
  });
}
