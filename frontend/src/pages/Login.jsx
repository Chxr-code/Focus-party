import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, USE_MOCK } from '../api/client';
import { usePageBackground } from '../scene/pageBackground.jsx';
import { useAuth } from '../auth.jsx';
import { useT } from '../i18n.jsx';

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();
  usePageBackground('forest');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', display_name: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage('');
    try {
      if (mode === 'login') await login({ username: form.username, password: form.password });
      else await register(form);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        setMessage(err.message);
      } else setMessage(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  const err = (key) => errors[key] && <span className="field-error">{errors[key][0]}</span>;

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 60 }}>
      <h1 style={{ textAlign: 'center', fontSize: 24, textShadow: '2px 0 0 var(--ink), -2px 0 0 var(--ink), 0 2px 0 var(--ink), 0 -2px 0 var(--ink), 3px 3px 0 var(--ink)', marginBottom: 8 }}>
        FOCUS PARTY
      </h1>
      <p style={{ textAlign: 'center', marginTop: 0, color: 'var(--text-on-bg)', textShadow: '1px 0 0 var(--ink), -1px 0 0 var(--ink), 0 1px 0 var(--ink), 0 -1px 0 var(--ink), 2px 2px 0 var(--ink)', fontWeight: 600 }}>{t('login.tagline')}</p>

      <form className="panel" onSubmit={submit}>
        <h2 style={{ marginBottom: 16 }}>{mode === 'login' ? t('login.start') : t('login.new')}</h2>
        {message && <div className="error-box">{message}</div>}

        <div className="field">
          <label htmlFor="username">{t('login.username')}</label>
          <input id="username" className="input" value={form.username} onChange={set('username')} autoComplete="username" />
          {err('username')}
        </div>

        {mode === 'register' && (
          <div className="field">
            <label htmlFor="display_name">{t('login.display')}</label>
            <input id="display_name" className="input" value={form.display_name} onChange={set('display_name')} />
            {err('display_name')}
          </div>
        )}

        <div className="field">
          <label htmlFor="password">{t('login.password')}</label>
          <input
            id="password"
            type="password"
            className="input"
            value={form.password}
            onChange={set('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {err('password')}
        </div>

        <button className="btn block" type="submit" disabled={busy}>
          {busy ? '...' : mode === 'login' ? t('login.login') : t('login.create')}
        </button>

        <button
          type="button"
          className="btn ghost block small"
          style={{ marginTop: 10 }}
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrors({}); setMessage(''); }}
        >
          {mode === 'login' ? t('login.to_register') : t('login.to_login')}
        </button>

        {USE_MOCK && (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
            {t('login.mock', { u: 'august', p: 'password123' })}
          </p>
        )}
      </form>
    </div>
  );
}
