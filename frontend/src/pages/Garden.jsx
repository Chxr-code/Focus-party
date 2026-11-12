import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth.jsx';
import { TREES } from '../constants.js';
import { useT } from '../i18n.jsx';
import { treeArt } from '../scene/art.js';
import { ThemePicker, loadGardenBackground, saveGardenBackground, usePageBackground } from '../scene/pageBackground.jsx';
import {
  GARDEN_THEMES, PLOTS, REVIVE_WATERINGS, gardenSection, isDead, lastWatered, reviveState, treeKind,
} from '../garden/life.js';
import Pet from '../components/Pet.jsx';
import './garden.css';

const PER_SECTION = PLOTS.length; // 12
const BASE = import.meta.env.BASE_URL;
const typeOf = (entry) => (TREES[entry.tree_type] ? entry.tree_type : 'cactus');

/** picture for a garden tree */
function plantSrc(entry, dead) {
  if (dead) return `${BASE}trees/${typeOf(entry)}-dead.png`;
  const kind = treeKind(entry);
  return kind === 'win' ? treeArt(entry.tree_type, 3, { win: true }) : treeArt(entry.tree_type, kind);
}

export default function Garden() {
  const { userId } = useParams();
  const { user, setUser } = useAuth();
  const { t, lang } = useT();
  const visiting = userId && Number(userId) !== user.id;

  const [owner, setOwner] = useState(visiting ? null : user);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [section, setSection] = useState(0);
  const [watering, setWatering] = useState(false);
  const [notice, setNotice] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [pageBg, setPageBg] = useState(loadGardenBackground);
  const track = useRef(null);
  usePageBackground(pageBg);

  useEffect(() => {
    setEntries(null);
    setError('');
    const req = visiting ? api.userGarden(userId) : api.garden().then((trees) => ({ user, trees }));
    req
      .then((res) => {
        setOwner(res.user);
        setEntries([...res.trees].sort((a, b) => a.finished_at.localeCompare(b.finished_at)));
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const now = Date.now();
  const sections = Math.max(1, Math.ceil((entries?.length ?? 0) / PER_SECTION));
  const theme = (visiting ? owner?.garden_theme : user.garden_theme) ?? 'pond';
  const deadCount = useMemo(() => entries?.filter((e) => isDead(e, now)).length ?? 0, [entries, now]);
  const bloomedCount = entries?.filter((e) => treeKind(e) === 3 || treeKind(e) === 'win').length ?? 0;
  const locale = lang === 'th' ? 'th-TH' : undefined;
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  // keep the field indicator in sync with horizontal scrolling / swiping
  function onScroll() {
    const el = track.current;
    if (el) setSection(Math.round(el.scrollLeft / el.clientWidth));
  }
  function goTo(i) {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  async function waterAll() {
    if (watering) return;
    setWatering(true);
    setNotice('');
    try {
      const fresh = await api.waterGarden();
      setEntries([...fresh].sort((a, b) => a.finished_at.localeCompare(b.finished_at)));
      if (selected) setSelected(fresh.find((e) => e.room_id === selected.room_id) ?? null);
      setNotice(t('garden.watered'));
    } catch (err) {
      setError(err.message);
    } finally {
      setTimeout(() => setWatering(false), 1600);
    }
  }

  async function saveName(e) {
    e.preventDefault();
    try {
      const updated = await api.renameTree(selected.room_id, nameDraft);
      setEntries((list) => list.map((x) => (x.room_id === updated.room_id ? { ...x, name: updated.name } : x)));
      setSelected((s) => ({ ...s, name: updated.name }));
    } catch (err) {
      setError(err.errors?.name?.[0] ?? err.message);
    }
  }

  async function pickTheme(key) {
    try {
      const updated = await api.updateSettings({ garden_theme: key });
      setUser((prev) => ({ ...prev, ...updated, garden_theme: updated.garden_theme ?? key }));
    } catch (err) {
      setError(err.errors?.garden_theme?.[0] ?? err.message);
    }
  }

  function select(entry) {
    if (selected?.room_id === entry.room_id) return setSelected(null);
    setSelected(entry);
    setNameDraft(entry.name ?? '');
  }

  const ownerName = owner?.display_name ?? '…';
  const selDead = selected ? isDead(selected, now) : false;
  const selRevive = selected && selDead ? reviveState(selected, now) : null;
  const selLabel = selected
    ? selDead ? t('garden.dead')
      : treeKind(selected) === 'win' ? t('garden.win') : treeKind(selected) === 3 ? t('garden.bloomed') : t('garden.not_bloomed')
    : '';

  return (
    <div className="container garden-page">
      <div className="row garden-top">
        <Link to={visiting ? '/friends' : '/'} className="btn ghost small">
          {visiting ? `◀ ${t('friends.title')}` : t('common.back_lobby')}
        </Link>
        <div>
          <h1 className="garden-heading">{t('garden.title', { name: ownerName })}</h1>
          {entries && (
            <p className="garden-sub">
              {t('garden.stats', { n: entries.length, b: bloomedCount })}
              {deadCount > 0 && ` · ${t('garden.dead_count', { n: deadCount })}`}
            </p>
          )}
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {visiting && owner && <p className="visit-note">{t('garden.visiting', { name: ownerName })}</p>}

      {/* ---------- the garden: one picture per 12 trees, scroll / swipe to the right ---------- */}
      <section className={`garden-view ${watering ? 'watering' : ''}`} aria-label={t('garden.title', { name: ownerName })}>
        <div className="garden-track" ref={track} onScroll={onScroll}>
          {Array.from({ length: sections }, (_, s) => {
            const bg = gardenSection(theme, s);
            const trees = (entries ?? []).slice(s * PER_SECTION, (s + 1) * PER_SECTION);
            return (
              <div
                key={s}
                className="garden-section"
                style={{ '--scene-bg': `url(${bg.lg})`, '--scene-bg-sm': `url(${bg.sm})` }}
              >
                {trees.map((entry, i) => {
                  const plot = PLOTS[i];
                  const dead = isDead(entry, now);
                  const isSel = selected?.room_id === entry.room_id;
                  return (
                    <button
                      key={entry.room_id}
                      type="button"
                      className={`plant ${dead ? 'dead' : ''} ${isSel ? 'selected' : ''}`}
                      style={{ left: `${plot.x}%`, top: `${plot.y}%`, zIndex: 10 + Math.floor(i / 4), animationDelay: `${(i % 5) * -0.7}s` }}
                      onClick={() => select(entry)}
                      aria-label={`${entry.name || entry.title} — ${dead ? t('garden.dead') : t(`tree.${typeOf(entry)}`)}`}
                      title={entry.name || entry.title}
                    >
                      <img src={plantSrc(entry, dead)} alt="" className="pixelated" />
                      {watering && !visiting && (
                        <span className="rain" aria-hidden="true"><i /><i /><i /></span>
                      )}
                      {entry.name && <span className="plant-name">{entry.name}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* overlays that stay put while the track scrolls */}
        {owner?.avatar?.pet?.type && (
          <Pet pet={owner.avatar.pet} size={48} className="garden-pet" title={owner.avatar.pet.name || ''} />
        )}

        {!visiting && entries && entries.length > 0 && (
          <button type="button" className={`can-btn ${watering ? 'pouring' : ''}`} onClick={waterAll} aria-label={t('garden.water')} title={t('garden.water')}>
            <img src={`${BASE}icons/watering-can.png`} alt="" className="pixelated" />
            {watering && <span className="can-drops" aria-hidden="true"><i /><i /><i /></span>}
          </button>
        )}

        {entries && entries.length === 0 && (
          <div className="garden-empty panel">
            <h3>{t('garden.empty')}</h3>
            {!visiting && <p className="muted">{t('garden.empty_sub')}</p>}
            {!visiting && <Link to="/" className="btn small">{t('garden.find')}</Link>}
          </div>
        )}

        {sections > 1 && (
          <>
            <button type="button" className="field-arrow left btn ghost small" onClick={() => goTo(section - 1)} disabled={section === 0} aria-label={t('garden.prev')}>◀</button>
            <button type="button" className="field-arrow right btn ghost small" onClick={() => goTo(section + 1)} disabled={section >= sections - 1} aria-label={t('garden.next')}>▶</button>
            <span className="field-count pixel">{t('garden.field', { n: section + 1, total: sections })}</span>
          </>
        )}
      </section>

      {/* ---------- selected tree ---------- */}
      <section className="panel garden-info" aria-live="polite">
        {selected ? (
          <div className="info-row">
            <img src={plantSrc(selected, selDead)} alt="" className="pixelated info-tree" />
            <div className="info-text">
              <h3>{selected.name || selected.title}</h3>
              <p className="muted">
                {t(`tree.${typeOf(selected)}`)} · {selLabel} · {selected.title} · {fmtDate(selected.finished_at)}
              </p>
              {selDead ? (
                <p className="health dead">
                  {t('garden.revive_need', { n: REVIVE_WATERINGS })}
                  {selRevive.count > 0 && ` (${selRevive.count}/${REVIVE_WATERINGS})`}
                </p>
              ) : (
                <p className="health">{t('garden.last_watered', { date: fmtDate(new Date(lastWatered(selected)).toISOString()) })}</p>
              )}
              {!visiting && (
                <form className="rename" onSubmit={saveName}>
                  <input className="input" value={nameDraft} maxLength={30} onChange={(e) => setNameDraft(e.target.value)} placeholder={t('garden.name_ph')} aria-label={t('garden.name_ph')} />
                  <button className="btn small" type="submit">{t('garden.rename')}</button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {notice || (entries === null ? t('garden.loading') : t('garden.tap'))}
          </p>
        )}
      </section>

      {!visiting && (
        <>
          <section className="panel garden-bg">
            <h3 style={{ marginBottom: 10 }}>{t('garden.theme')}</h3>
            {/* scrollable row of small previews; name + status under each. Locked = black & white */}
            <div className="gtheme-row" role="radiogroup" aria-label={t('garden.theme')}>
              {GARDEN_THEMES.map((g) => {
                const locked = user.level < g.level;
                const using = theme === g.key;
                return (
                  <div key={g.key} className={`gtheme-card ${using ? 'using' : ''} ${locked ? 'locked' : ''}`}>
                    <img src={gardenSection(g.key, 0).sm} alt="" loading="lazy" />
                    <span className="gtheme-name">{t(`gtheme.${g.key}`)}</span>
                    {locked ? (
                      <span className="gtheme-tag lock">Lv.{g.level}</span>
                    ) : using ? (
                      <span className="gtheme-tag using" role="radio" aria-checked="true">✓ {t('garden.using')}</span>
                    ) : (
                      <button type="button" role="radio" aria-checked="false" className="gtheme-tag use" onClick={() => pickTheme(g.key)}>
                        {t('garden.use_theme')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="muted gtheme-hint">◀ {t('garden.scroll_themes')} ▶</p>
          </section>

          <section className="panel garden-bg">
            <h3 style={{ marginBottom: 10 }}>{t('garden.bg')}</h3>
            <ThemePicker value={pageBg} onChange={(key) => { setPageBg(key); saveGardenBackground(key); }} t={t} label={t('garden.bg')} />
          </section>
        </>
      )}
    </div>
  );
}
