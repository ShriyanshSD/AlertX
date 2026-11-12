import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowUp, Bot, BookOpen, CircleHelp, Eraser, LoaderCircle, MessageSquare, ShieldAlert, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '../components/UI.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { getApiError } from '../services/api.js';

const suggestions = [
  'What should I do if someone gets injured?',
  'What should I do during a fire?',
  'How do I activate SOS?',
  'How can I alert my trusted contacts?',
];
const AI_CHAT_TIMEOUT_MS = 30000;

function getChatError(error) {
  if (error.code === 'ECONNABORTED') {
    return 'The assistant took too long to respond. Please try again; for urgent safety guidance, contact local emergency services directly.';
  }
  return getApiError(error);
}

export default function Assistant() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [saveHistory, setSaveHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(Boolean(user));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setHistoryLoading(false);
      return undefined;
    }
    let active = true;
    api.get('/ai/conversation')
      .then(({ data }) => {
        if (active) setMessages(data.data.messages || []);
      })
      .catch((requestError) => {
        if (active) setError(getApiError(requestError));
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async (value = message) => {
    const text = value.trim();
    if (!text || loading) return;
    if (!user) {
      setError('Sign in to use the secure AlertX assistant.');
      return;
    }
    const question = { role: 'user', content: text, createdAt: new Date().toISOString() };
    setMessages((items) => [...items, question]);
    setMessage('');
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', { message: text, saveHistory }, { timeout: AI_CHAT_TIMEOUT_MS });
      setMessages((items) => {
        const answer = {
          role: 'assistant',
          content: data.data.answer,
          citations: data.data.citations || [],
          emergency: data.data.emergency,
          createdAt: new Date().toISOString(),
        };
        return data.data.messages || [...items, answer];
      });
      setNotice(data.data.warning || '');
    } catch (requestError) {
      setMessages((items) => items.filter((item) => item !== question));
      setError(getChatError(requestError));
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm('Delete your saved AlertX AI conversation and assistant activity record?')) return;
    setError('');
    try {
      await api.delete('/ai/conversation');
      setMessages([]);
      setNotice('Saved conversation and associated assistant activity were deleted.');
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  };

  return <>
    <SectionHeading eyebrow="ALERTX AI · GROUNDED CHAT" title="AlertX AI Assistant" description="Chat naturally. Safety and AlertX guidance is grounded in sources when available; urgent issues are handled conservatively." action={<span className="demo-pill"><Sparkles size={13} /> SAFETY-FIRST</span>} />
    <div className="assistant-layout">
      <section className="panel assistant-chat">
        <div className="assistant-chat-head">
          <div className="assistant-avatar"><Bot size={20} /></div>
          <div><strong>AlertX AI Assistant</strong><small><i /> Conversational · AlertX never dispatches automatically</small></div>
          <button className="button secondary chat-clear" type="button" onClick={clearHistory} disabled={loading || historyLoading}><Eraser size={14} />Clear</button>
        </div>
        <div className="chat-body" ref={chatBodyRef} aria-live="polite">
          {historyLoading && <div className="chat-loading"><LoaderCircle size={16} className="spinner-icon" /> Loading private chat history…</div>}
          {!messages.length && !historyLoading && <div className="chat-welcome">
            <div className="assistant-avatar large"><Bot size={25} /></div>
            <h2>How can I help?</h2>
            <p>Chat normally or ask about safety and AlertX. Safety guidance uses retrieved sources when available.</p>
            <div className="chat-suggestions">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => send(suggestion)}>{suggestion}</button>)}</div>
          </div>}
          {messages.map((item, index) => <article className={`chat-exchange ${item.role === 'user' ? 'user-exchange' : ''}`} key={`${item.createdAt || index}-${index}`}>
            <div className={item.role === 'user' ? 'chat-user' : 'chat-response'}>
              {item.role === 'user' ? <MessageSquare size={14} /> : <Bot size={15} />}
              <span className="chat-message-text">{item.content}</span>
            </div>
            {item.role === 'assistant' && item.citations?.length > 0 && <div className="chat-citations">
              <strong><BookOpen size={13} /> Sources</strong>
              {item.citations.map((citation, citationIndex) => <a key={`${citation.sourceTitle}-${citationIndex}`} href={citation.sourceUrl || undefined} target={citation.sourceUrl ? '_blank' : undefined} rel={citation.sourceUrl ? 'noreferrer' : undefined}>
                [{citationIndex + 1}] {citation.title} · {citation.sourceTitle}
              </a>)}
            </div>}
            {item.role === 'assistant' && item.emergency?.offerSos && <div className="chat-emergency-actions">
              <p><ShieldAlert size={15} /> If this is happening now, contact local emergency services immediately. In India, call 112. AlertX will not call or dispatch automatically.</p>
              <Link className="button danger" to="/sos">Open AlertX SOS</Link>
              {item.emergency.askLocation && <Link className="button secondary" to="/tracking">Choose whether to share location</Link>}
            </div>}
          </article>)}
          {loading && <div className="chat-loading"><LoaderCircle size={16} className="spinner-icon" /> Thinking through your question…</div>}
          {notice && <p className="chat-notice" role="status">{notice}</p>}
          {error && <p className="form-error chat-error" role="alert">{error}</p>}
        </div>
        <div className="chat-history-consent">
          <label><input type="checkbox" checked={saveHistory} onChange={(event) => setSaveHistory(event.target.checked)} /> Save this conversation to my account</label>
          <small>Optional and private to your account. Questions are not sent to Gemini with your saved history; you can clear saved data anytime.</small>
        </div>
        <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}>
          <input placeholder="Ask a safety or AlertX question…" value={message} maxLength={1200} onChange={(event) => setMessage(event.target.value)} aria-label="Message the AlertX AI assistant" />
          <button className="chat-send" type="submit" aria-label="Send message" disabled={!message.trim() || loading || historyLoading}><ArrowUp size={17} /></button>
        </form>
      </section>
      <aside className="assistant-aside">
        <section className="panel"><div className="panel-heading"><div><h2>Suggested questions</h2><p>Answers include source references</p></div></div><div className="suggestion-list">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => send(suggestion)}>{suggestion}<CircleHelp size={15} /></button>)}</div></section>
        <section className="assistant-safety"><ShieldAlert size={18} /><div><strong>In immediate danger?</strong><p>Call local emergency services now. In India, call 112. This AlertX workspace cannot call, notify authorities, or dispatch a vehicle.</p><Link to="/sos">Open the SOS request page</Link></div></section>
        <section className="panel assistant-privacy"><div className="panel-heading"><div><h2><Activity size={14} /> Privacy and limits</h2><p>Safety replies are grounded in retrieved sources</p></div></div><p>Do not enter passwords, personal medical details, or other sensitive information. If Gemini is configured, your current question and any retrieved public guidance are sent to Google to generate a reply; prior chat history and account details are not sent. For general topics, Gemini may use its general model knowledge. For aggregate admin metrics, AlertX stores your account ID, topic category, provider, emergency-related flag, and timestamp—not message content. Clear removes this activity and any saved conversation.</p></section>
      </aside>
    </div>
  </>;
}
