import { z } from "zod";

export const feedbackSchema = z.object({
  category: z.enum(["suggestion", "bug", "contact"]),
  subject: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4000),
});
export const feedbackStatusSchema = z.enum(["new", "read", "resolved"]);
export type FeedbackDraft = z.infer<typeof feedbackSchema>;
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;
export type FeedbackMessage = FeedbackDraft & { id: string; senderName: string; senderEmail: string; status: FeedbackStatus; createdAt: string };
export type FeedbackError = "Sign in with an online account to contact administrators." | "Feedback is not enabled yet." | "Check the message details and try again." | "Too many messages. Try again later." | "You do not have permission to manage Atlas." | "The request could not be saved. Refresh and try again.";
export type FeedbackResult<T> = { ok: true; data: T } | { ok: false; error: FeedbackError };
export type FeedbackAdminActions = { load: () => Promise<FeedbackResult<FeedbackMessage[]>>; setStatus: (id: string, status: FeedbackStatus) => Promise<FeedbackResult<null>> };
export const feedbackCategoryLabels = { suggestion: "Suggestion", bug: "Bug report", contact: "Other message" } as const;
export const feedbackStatusLabels = { new: "New message", read: "Read message", resolved: "Resolved message" } as const;
