import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { DURATION_PRESETS, TREES } from '../constants.js';
import { useAuth } from '../auth.jsx';
import { treeArt } from '../scene/art.js';
import { ThemePicker } from '../scene/pageBackground.jsx';
import { useT } from '../i18n.jsx';
import { BOSS_MIN_LEVEL, BREAK_LENGTH_OPTIONS, MIN_BREAK_ROOM, breakEveryOptions, MAX_BOSS_DURATION, MAX_DURATION, MIN_DURATION } from '../rules.js';

export default function CreateRoomModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const { t } = useT();
  const [form, setForm] = useState({
    title: '',
    topic: '',
    location: '',
    tree_type: 'cactus',
    duration_minutes: 25,
    max_members: 4,
    boss_id: '',
    theme: 'forest',
    chat_enabled: true,
    breaks: false,
    break_every: 30,
    break_minutes: 10,
  });
  // boss rooms default to the dark forest until the host picks a theme themselves
  const [themeTouched, setThemeTouched] = useState(false);
  const theme = themeTouched ? form.theme : form.boss_id ? 'dark' : 'forest';
  const [bosses, setBosses] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listBosses().then((list) => setBosses(list.filter((b) => !b.defeated_at))).catch(() => {});
  }, []);

  // close with Esc
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const bossLocked = user.level < BOSS_MIN_LEVEL;
  const maxMinutes = form.boss_id ? MAX_BOSS_DURATION : MAX_DURATION;
  // breaks: only for rooms of 50+ minutes, "every" must be shorter than the room
  const everyOptions = breakEveryOptions(Number(form.duration_minutes) || 0);
  const canBreak = (Number(form.duration_minutes) || 0) >= MIN_BREAK_ROOM;
  const breakEvery = everyOptions.includes(Number(form.break_every)) ? Number(form.break_every) : everyOptions[everyOptions.length - 1];

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage('');
    try {
      const { breaks, ...rest } = form;
      const withBreaks = breaks && canBreak;
      const room = await api.createRoom({
        ...rest,
        break_every: withBreaks ? breakEvery : 0,
        break_minutes: withBreaks ? Number(form.break_minutes) : 0,
        duration_minutes: Number(form.duration_minutes),
        max_members: Number(form.max_members),
        boss_id: form.boss_id ? Number(form.boss_id) : null,
        theme,
      });
      onCreated(room);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        setMessage(err.message);
      } else setMessage(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  const err = (key) => errors[key] && <span className="field-error">{errors[key][0]}</span>;

  return (
    <div className="overlay" onClick={onClose}>
      <form className="panel modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-labelledby="create-title">
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 id="create-title">{t('create.title')}</h2>
          <span className="spacer" />
          <button type="button" className="btn ghost small" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        {message && <div className="error-box">{message}</div>}

        <div className="field">
          <label htmlFor="title">{t('create.name')}</label>
          <input id="title" className="input" value={form.title} onChange={set('title')} placeholder={t('create.name_ph')} maxLength={60} autoFocus />
          {err('title')}
        </div>

        <div className="field">
          <label htmlFor="topic">{t('create.topic')}</label>
          <input id="topic" className="input" value={form.topic} onChange={set('topic')} placeholder={t('create.topic_ph')} maxLength={40} />
          {err('topic')}
        </div>

        <div className="field">
          <label htmlFor="location">{t('create.location')}</label>
          <input id="location" className="input" value={form.location} onChange={set('location')} placeholder={t('create.location_ph')} maxLength={60} />
        </div>

        <div className="field">
          <label>{t('create.tree')}</label>
          <div className="tree-picker">
            {Object.entries(TREES).map(([key, tree]) => {
              const locked = user.level < tree.unlockLevel;
              return (
                <button
                  type="button"
                  key={key}
                  className={`tree-option ${form.tree_type === key ? 'selected' : ''}`}
                  onClick={() => setForm({ ...form, tree_type: key })}
                  disabled={locked}
                  aria-pressed={form.tree_type === key}
                >
                  <span className="tree-thumb">
                    <img src={treeArt(key, 3)} alt="" className={`pixelated ${locked ? 'locked' : ''}`} />
                                      </span>
                  <span className="pixel" style={{ fontSize: 8 }}>{locked ? `LV.${tree.unlockLevel}` : t(`tree.${key}`)}</span>
                </button>
              );
            })}
          </div>
          {err('tree_type')}
        </div>

        <div className="field">
          <label>{t('create.duration')}</label>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {DURATION_PRESETS.map((m) => (
              <button
                type="button"
                key={m}
                className={`btn small ${Number(form.duration_minutes) === m ? 'gold' : 'ghost'}`}
                onClick={() => setForm({ ...form, duration_minutes: m })}
              >
                {m} {t('common.min')}
              </button>
            ))}
            <input
              type="number"
              className="input"
              style={{ width: 90 }}
              min={MIN_DURATION}
              max={maxMinutes}
              value={form.duration_minutes}
              onChange={set('duration_minutes')}
              aria-label={t('create.custom_min')}
            />
          </div>
          {err('duration_minutes')}
        </div>

        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="max">{t('create.max')}</label>
            <select id="max" className="input" value={form.max_members} onChange={set('max_members')}>
              {[2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {err('max_members')}
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="boss">{t('create.boss')}</label>
            <select id="boss" className="input" value={form.boss_id} onChange={set('boss_id')} disabled={bossLocked}>
              <option value="">{bossLocked ? t('create.boss_locked', { lv: BOSS_MIN_LEVEL }) : t('create.no_boss')}</option>
              {!bossLocked && bosses.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.max_hp} HP)</option>
              ))}
            </select>
            {err('boss_id')}
          </div>
        </div>

        {canBreak && (
        <div className="field">
          <label>{t('create.breaks')}</label>
          <div className="switch-row" role="radiogroup" aria-label={t('create.breaks')}>
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={form.breaks === v}
                className={`btn small ${form.breaks === v ? 'gold' : 'ghost'}`}
                onClick={() => setForm({ ...form, breaks: v })}
              >
                {v ? t('create.with_break') : t('create.no_break')}
              </button>
            ))}
          </div>
          {form.breaks && (
            <div className="row" style={{ gap: 12, marginTop: 10 }}>
              <label className="break-select">
                <span>{t('create.break_every')}</span>
                <select className="input" value={breakEvery} onChange={set('break_every')}>
                  {everyOptions.map((n) => <option key={n} value={n}>{n} {t('common.min')}</option>)}
                </select>
              </label>
              <label className="break-select">
                <span>{t('create.break_len')}</span>
                <select className="input" value={form.break_minutes} onChange={set('break_minutes')}>
                  {BREAK_LENGTH_OPTIONS.map((n) => <option key={n} value={n}>{n} {t('common.min')}</option>)}
                </select>
              </label>
            </div>
          )}
          {err('break_minutes')}
          {err('break_every')}
        </div>
        )}

        <div className="field">
          <label>{t('create.chat')}</label>
          <div className="switch-row" role="radiogroup" aria-label={t('create.chat')}>
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={form.chat_enabled === v}
                className={`btn small ${form.chat_enabled === v ? 'gold' : 'ghost'}`}
                onClick={() => setForm({ ...form, chat_enabled: v })}
              >
                {v ? t('create.chat_on') : t('create.chat_off')}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>{t('create.theme')}</label>
          <ThemePicker
            value={theme}
            onChange={(key) => { setThemeTouched(true); setForm({ ...form, theme: key }); }}
            t={t}
            label={t('create.theme')}
          />
        </div>

        <button className="btn block" type="submit" disabled={saving}>
          {saving ? t('create.creating') : t('create.submit')}
        </button>
      </form>
    </div>
  );
}
