"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Mail, Send } from "lucide-react";
import { feedbackCategoryLabels, feedbackSchema, type FeedbackDraft, type FeedbackResult } from "@/lib/feedback";
import { useI18n } from "@/components/i18n/provider";

export default function FeedbackPage({ onSend }: { onSend?: (draft: FeedbackDraft) => Promise<FeedbackResult<string>> }) {
  const { t } = useI18n();
  const [category, setCategory] = useState<FeedbackDraft["category"]>("suggestion");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!onSend || pending) return;
    setError(""); setSent(false);
    const parsed = feedbackSchema.safeParse({ category, subject, body });
    if (!parsed.success) { setError(t("Check the message details and try again.")); return; }
    startTransition(async () => {
      try {
        const response = await onSend(parsed.data);
        if (!response.ok) { setError(t(response.error)); return; }
        setSubject(""); setBody(""); setSent(true);
      } catch { setError(t("The request could not be saved. Refresh and try again.")); }
    });
  }
  return <section className="settings-card feedback-page">
    <div className="settings-card-heading"><span className="large-icon"><Mail size={23} /></span><div><h2>{t("Contact administrators")}</h2><p>{t("Send a suggestion or report a bug.")}</p></div></div>
    {!onSend && <p className="field-hint" role="status">{t("Sign in with an online account to contact administrators.")}</p>}
    <form className="character-form" onSubmit={submit}>
      <fieldset disabled={pending || !onSend}>
        <label>{t("Message type")}<select className="soft-input" name="feedback-category" value={category} onChange={event => setCategory(event.target.value as FeedbackDraft["category"])}>{Object.entries(feedbackCategoryLabels).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label>
        <label>{t("Subject")}<input className="soft-input" name="feedback-subject" dir="auto" required maxLength={120} value={subject} onChange={event => setSubject(event.target.value)} /></label>
        <label>{t("Message")}<textarea className="soft-input" name="feedback-body" dir="auto" required maxLength={4000} rows={7} value={body} onChange={event => setBody(event.target.value)} /></label>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}{sent && <p className="form-success" role="status">{t("Your message was sent to the administrators.")}</p>}
      <button type="submit" className="primary-button" disabled={pending || !onSend}><Send size={16} />{pending ? t("Sending…") : t("Send message")}</button>
    </form>
  </section>;
}
