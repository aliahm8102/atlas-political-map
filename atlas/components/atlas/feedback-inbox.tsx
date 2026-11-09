"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { feedbackCategoryLabels, feedbackStatusLabels, type FeedbackAdminActions, type FeedbackMessage, type FeedbackStatus } from "@/lib/feedback";
import { normalizeSearch } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/provider";

export default function FeedbackInbox({ actions }: { actions: FeedbackAdminActions }) {
  const { t, date } = useI18n();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FeedbackStatus | "">("");
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await actions.load(); if (response.ok) setMessages(response.data); else setError(t(response.error)); }
    catch { setError(t("The request could not be saved. Refresh and try again.")); }
    finally { setLoading(false); }
  }, [actions, t]);
  useEffect(() => { const timer = window.setTimeout(() => startTransition(reload), 0); return () => clearTimeout(timer); }, [reload]);
  function update(id: string, next: FeedbackStatus) {
    if (pending) return;
    setError(""); setNotice("");
    startTransition(async () => {
      try { const response = await actions.setStatus(id, next); if (!response.ok) { setError(t(response.error)); return; } setMessages(previous => previous.map(message => message.id === id ? { ...message, status: next } : message)); setNotice(t("Message status updated.")); }
      catch { setError(t("The request could not be saved. Refresh and try again.")); }
    });
  }
  const visible = messages.filter(message => (!status || status === message.status) && normalizeSearch([message.subject, message.body, message.senderName, message.senderEmail, t(feedbackCategoryLabels[message.category])].join(" ")).includes(normalizeSearch(query)));
  return <section className="feedback-inbox" aria-label={t("User messages")}>
    <div className="admin-toolbar"><label className="admin-search"><input type="search" aria-label={t("Search messages")} placeholder={t("Search messages")} value={query} onChange={event => setQuery(event.target.value)} /></label><select className="soft-input feedback-status-filter" aria-label={t("Message status")} value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="">{t("All message statuses")}</option>{Object.entries(feedbackStatusLabels).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select><button className="secondary-button" disabled={pending} onClick={() => startTransition(reload)}>{t("Refresh")}</button></div>
    {error && <p className="admin-alert error" role="alert">{error}</p>}{notice && <p className="admin-alert" role="status">{notice}</p>}{loading && <p className="field-hint" role="status">{t("Loading messages…")}</p>}
    {!loading && !error && !visible.length && <p className="admin-empty">{t("No user messages.")}</p>}
    <div className="feedback-messages">{visible.map(message => <article className="settings-card feedback-message" key={message.id} data-feedback-id={message.id}>
      <div className="section-heading"><h3 dir="auto">{message.subject}</h3><span className={`feedback-status feedback-${message.status}`}>{t(feedbackStatusLabels[message.status])}</span></div>
      <p className="field-hint">{t(feedbackCategoryLabels[message.category])} · <bdi>{message.senderName}</bdi> · <bdi>{message.senderEmail}</bdi> · {date(message.createdAt, { day: "numeric", month: "short", year: "numeric" })}</p>
      <p className="feedback-body" dir="auto">{message.body}</p>
      <div className="admin-actions">{message.status !== "read" && <button className="secondary-button" disabled={pending} onClick={() => update(message.id, "read")}>{t("Mark as read")}</button>}{message.status !== "resolved" && <button className="primary-button" disabled={pending} onClick={() => update(message.id, "resolved")}>{t("Mark as resolved")}</button>}{message.status !== "new" && <button className="text-link" disabled={pending} onClick={() => update(message.id, "new")}>{t("Reopen message")}</button>}</div>
    </article>)}</div>
  </section>;
}
