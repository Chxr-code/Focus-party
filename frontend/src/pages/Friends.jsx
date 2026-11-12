import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth.jsx';
import { useT } from '../i18n.jsx';
import Avatar from '../components/Avatar.jsx';
import { loadBackground, usePageBackground } from '../scene/pageBackground.jsx';
import './friends.css';

function PersonRow({ person, children }) {
  return (
    <li className="person">
      <Avatar avatar={person.avatar} size={44} />
      <div className="person-info">
        <b>{person.display_name}</b>
        <small className="muted">@{person.username} · Lv.{person.level}</small>
      </div>
      <span className="spacer" />
      <div className="person-actions">{children}</div>
    </li>
  );
}

export default function Friends() {
  usePageBackground(loadBackground('lobby')); // same background as the lobby
  const { t } = useT();
  const { user, setUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api.friends().then(setData).catch((err) => setError(err.message));
  }, []);

  async function run(key, fn) {
    setBusyId(key);
    setError('');
    try {
      setData(await fn());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAllow(e) {
    const allow = e.target.checked;
    setError('');
    try {
      const updated = await api.updateSettings({ allow_friend_requests: allow });
      setUser((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setError(err.message);
    }
  }

  const allow = user.allow_friend_requests !== false;

  return (
    <div className="container friends-page">
      <div className="row" style={{ marginBottom: 16, gap: 14 }}>
        <Link to="/" className="btn ghost small">{t('common.back_lobby')}</Link>
        <h1 className="friends-heading">{t('friends.title')}</h1>
      </div>

      {error && <div className="error-box">{error}</div>}

      <section className="panel friends-section">
        <h3>{t('friends.settings')}</h3>
        <label className="toggle">
          <input type="checkbox" checked={allow} onChange={toggleAllow} />
          <span className="toggle-ui" aria-hidden="true" />
          <span>
            {t('friends.allow')}
            <small className="muted">{t('friends.allow_hint')}</small>
          </span>
        </label>
      </section>

      {!data ? (
        <p className="pixel" style={{ textAlign: 'center' }}>{t('common.loading')}</p>
      ) : (
        <>
          <section className="panel friends-section">
            <h3>{t('friends.requests')} {data.incoming.length > 0 && <span className="count">{data.incoming.length}</span>}</h3>
            {data.incoming.length === 0 ? (
              <p className="muted">{t('friends.no_requests')}</p>
            ) : (
              <ul className="people">
                {data.incoming.map((r) => (
                  <PersonRow key={r.id} person={r.user}>
                    <button className="btn small" disabled={busyId === r.id} onClick={() => run(r.id, () => api.respondFriendRequest(r.id, true))}>{t('friends.accept')}</button>
                    <button className="btn ghost small" disabled={busyId === r.id} onClick={() => run(r.id, () => api.respondFriendRequest(r.id, false))} aria-label="decline">{t('friends.decline')}</button>
                  </PersonRow>
                ))}
              </ul>
            )}
            {data.outgoing.length > 0 && (
              <>
                <h3 className="sub-h">{t('friends.sent')}</h3>
                <ul className="people">
                  {data.outgoing.map((r) => (
                    <PersonRow key={r.id} person={r.user}>
                      <button className="btn ghost small" disabled={busyId === r.id} onClick={() => run(r.id, () => api.respondFriendRequest(r.id, false))}>{t('friends.cancel')}</button>
                    </PersonRow>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="panel friends-section">
            <h3>{t('friends.list')} <span className="count">{data.friends.length}</span></h3>
            {data.friends.length === 0 ? (
              <p className="muted">{t('friends.none')}</p>
            ) : (
              <ul className="people">
                {data.friends.map((f) => (
                  <PersonRow key={f.id} person={f}>
                    <Link to={`/garden/${f.id}`} className="btn small">{t('friends.visit')}</Link>
                    <button className="btn ghost small" disabled={busyId === `f${f.id}`} onClick={() => run(`f${f.id}`, () => api.removeFriend(f.id))}>{t('friends.remove')}</button>
                  </PersonRow>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
