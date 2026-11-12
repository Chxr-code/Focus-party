import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth.jsx';
import { MAX_LEVEL } from '../constants.js';
import { useT } from '../i18n.jsx';

// Admin accounts only: jump to any level to preview what unlocks (trees, garden themes, pets).
export default function AdminPanel() {
  const { user, setUser } = useAuth();
  const { t } = useT();
  const [level, setLevel] = useState(user.level);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user.role !== 'admin') return null;

  async function apply(lv) {
    setBusy(true);
    setError('');
    try {
      const updated = await api.adminSetLevel(lv);
      setUser((prev) => ({ ...prev, ...updated }));
      setLevel(updated.level);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel admin-panel" aria-label={t('admin.title')}>
      <span className="chip red">{t('admin.title')}</span>
      <label className="admin-level">
        <span className="pixel">{t('admin.level')}</span>
        <input type="range" min={1} max={MAX_LEVEL} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
        <input type="number" className="input" min={1} max={MAX_LEVEL} value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label={t('admin.level')} />
      </label>
      <div className="row" style={{ gap: 6 }}>
        {[1, 5, 10, 22, MAX_LEVEL].map((lv) => (
          <button key={lv} type="button" className="btn ghost small" onClick={() => apply(lv)} disabled={busy}>Lv.{lv}</button>
        ))}
        <button type="button" className="btn gold small" onClick={() => apply(level)} disabled={busy}>{t('admin.apply')}</button>
      </div>
      {error && <small className="field-error">{error}</small>}
    </section>
  );
}
