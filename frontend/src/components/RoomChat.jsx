import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n.jsx';

// Room chat panel. Messages arrive by polling (see Room.jsx), so it feels near real-time
// on a plain PHP server without WebSockets.
export default function RoomChat({ messages, meId, canSend, onSend, onClose }) {
  const { t } = useT();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const list = useRef(null);

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length]);

  async function submit(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError('');
    try {
      await onSend(body);
      setText('');
    } catch (err) {
      setError(err.errors?.body?.[0] ?? err.message);
    } finally {
      setSending(false);
    }
  }

  const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <section className="panel room-chat" aria-label={t('chat.title')}>
      <div className="row" style={{ marginBottom: 8 }}>
        <h3>{t('chat.title')}</h3>
        <span className="spacer" />
        <button type="button" className="btn ghost small" onClick={onClose} aria-label={t('common.close')}>✕</button>
      </div>

      <ul className="chat-list" ref={list} aria-live="polite">
        {messages.length === 0 && <li className="muted chat-empty">{t('chat.empty')}</li>}
        {messages.map((m) => (
          <li key={m.id} className={`chat-msg ${m.user_id === meId ? 'mine' : ''}`}>
            <span className="chat-meta">
              <b>{m.user_id === meId ? t('common.you') : m.display_name}</b> · {time(m.created_at)}
            </span>
            <span className="chat-body">{m.body}</span>
          </li>
        ))}
      </ul>

      {error && <div className="error-box" style={{ margin: '8px 0 0' }}>{error}</div>}

      {canSend ? (
        <form className="chat-form" onSubmit={submit}>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('chat.placeholder')}
            maxLength={200}
            aria-label={t('chat.placeholder')}
          />
          <button className="btn small" type="submit" disabled={sending || !text.trim()}>{t('chat.send')}</button>
        </form>
      ) : (
        <p className="muted" style={{ margin: '8px 0 0' }}>{t('chat.join_first')}</p>
      )}
    </section>
  );
}
