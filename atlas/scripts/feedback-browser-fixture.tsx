// In-memory test fixture. Never mounted on an application route.
import { useCallback, useMemo, useState } from "react";
import FeedbackPage from "../components/atlas/feedback-page";
import AdminPanel from "../components/atlas/admin-panel";
import LanguageSwitcher from "../components/i18n/language-switcher";
import type { AdministrationActions } from "../lib/administration";
import type { FeedbackAdminActions, FeedbackDraft, FeedbackMessage, FeedbackResult } from "../lib/feedback";
import countries from "../data/countries.json";

const adminActions: AdministrationActions = {
  load: async () => ({ ok: true, data: { people: [], submissions: [], accounts: [] } }),
  save: async () => ({ ok: true, data: "fixture" }), remove: async () => ({ ok: true, data: null }),
  review: async () => ({ ok: true, data: null }), accounts: async () => ({ ok: true, data: [] }), setAdmin: async () => ({ ok: true, data: null }),
};
export default function FeedbackFixture() {
  const [admin, setAdmin] = useState(false);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [fail, setFail] = useState(false);
  const onPeopleChange = useCallback(() => {}, []);
  const online = new URLSearchParams(location.search).get("mode") !== "local";
  async function send(draft: FeedbackDraft): Promise<FeedbackResult<string>> {
    await new Promise(resolve => setTimeout(resolve, 80));
    if (fail) return { ok: false, error: "The request could not be saved. Refresh and try again." };
    const id = crypto.randomUUID();
    setMessages(previous => [...previous, { ...draft, id, status: "new", senderName: "QA User", senderEmail: "qa@example.test", createdAt: new Date().toISOString() }]);
    return { ok: true, data: id };
  }
  const feedbackActions = useMemo<FeedbackAdminActions>(() => ({
    load: async () => ({ ok: true, data: messages }),
    setStatus: async (id, status) => { setMessages(previous => previous.map(item => item.id === id ? { ...item, status } : item)); return { ok: true, data: null }; },
  }), [messages]);
  return <div className="atlas-app"><main className="main-content">
    <div className="fixture-toolbar"><button id="test-feedback-user" onClick={() => setAdmin(false)}>User form</button><button id="test-feedback-admin" onClick={() => setAdmin(true)}>Administrator panel</button><label><input id="test-feedback-failure" type="checkbox" checked={fail} onChange={event => setFail(event.target.checked)} />Simulate failure</label><LanguageSwitcher /></div>
    {admin ? <AdminPanel accessRole="admin" countries={countries} actions={adminActions} feedbackActions={feedbackActions} onPeopleChange={onPeopleChange} /> : <FeedbackPage onSend={online ? send : undefined} />}
  </main></div>;
}
