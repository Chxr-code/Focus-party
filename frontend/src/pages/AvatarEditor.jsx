import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { loadBackground, usePageBackground } from '../scene/pageBackground.jsx';
import { useAuth } from '../auth.jsx';
import Avatar from '../components/Avatar.jsx';
import {
  HAIR_COLORS, HAIR_STYLES, OUTFIT_COLORS, OUTFIT_NAMES, OUTFITS, SKIN_TONES, normalizeAvatar, randomAvatar,
} from '../avatar/parts.js';
import { useT } from '../i18n.jsx';
import Pet from '../components/Pet.jsx';
import { PETS, petPalettes } from '../pets/pets.js';
import './avatar.css';

function Swatches({ label, palettes, value, onChange }) {
  return (
    <fieldset className="option-group">
      <legend>{label}</legend>
      <div className="swatches">
        {Object.entries(palettes).map(([name, [light, base, shadow]]) => (
          <button
            key={name}
            type="button"
            className={`swatch ${value === name ? 'selected' : ''}`}
            style={{ background: `linear-gradient(135deg, ${light} 0 30%, ${base} 30% 70%, ${shadow} 70%)` }}
            onClick={() => onChange(name)}
            aria-pressed={value === name}
            aria-label={name}
            title={name}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Styles({ label, options, value, onChange, preview, names }) {
  return (
    <fieldset className="option-group">
      <legend>{label}</legend>
      <div className="style-grid">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            className={`style-option ${value === n ? 'selected' : ''}`}
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            aria-label={names?.[n] ?? `${label} ${n}`}
            title={names?.[n]}
          >
            <Avatar avatar={preview(n)} size={64} framed={false} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function AvatarEditor() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  usePageBackground(loadBackground('lobby')); // same background as the lobby
  const { t } = useT();
  const [avatar, setAvatar] = useState(() => ({ ...normalizeAvatar(user.avatar), pet: user.avatar?.pet ?? null }));
  const pet = avatar.pet ?? { type: null, color: 'cream', name: '' };
  const setPet = (patch) => setAvatar((a) => ({ ...a, pet: { ...pet, ...patch } }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (value) => setAvatar((a) => ({ ...a, [key]: value }));

  async function save() {
    setSaving(true);
    setError('');
    try {
      const clean = pet.type ? { ...avatar, pet: { type: pet.type, color: pet.color, name: (pet.name ?? '').trim().slice(0, 20) } } : { ...avatar, pet: null };
      const updated = await api.updateAvatar(clean);
      setUser((prev) => ({ ...prev, ...updated }));
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container avatar-page">
      <div className="row" style={{ marginBottom: 16 }}>
        <Link to="/" className="btn ghost small">{t('common.back_lobby')}</Link>
        <h1 className="avatar-heading">{t('avatar.title')}</h1>
      </div>

      <div className="avatar-layout">
        <section className="panel preview-panel">
          <div className="preview-stage">
            <Avatar avatar={avatar} size={192} framed={false} title={t('avatar.title')} />
            {pet.type && <Pet pet={pet} size={96} className="preview-pet" />}
          </div>
          <h2 style={{ textAlign: 'center' }}>{user.display_name}</h2>
          <p className="muted" style={{ textAlign: 'center', margin: '6px 0 14px' }}>Lv.{user.level}</p>
          {error && <div className="error-box">{error}</div>}
          <div className="preview-actions">
            <button type="button" className="btn ghost" onClick={() => setAvatar((a) => ({ ...randomAvatar(), pet: a.pet }))}>{t('avatar.random')}</button>
            <button type="button" className="btn gold" onClick={save} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</button>
          </div>
        </section>

        <section className="panel options-panel">
          <Styles label={t('avatar.hair')} options={HAIR_STYLES} value={avatar.hair} onChange={set('hair')} preview={(n) => ({ ...avatar, hair: n })} />
          <Swatches label={t('avatar.hair_color')} palettes={HAIR_COLORS} value={avatar.hairColor} onChange={set('hairColor')} />
          <Styles label={t('avatar.outfit')} options={OUTFITS} value={avatar.outfit} onChange={set('outfit')} preview={(n) => ({ ...avatar, outfit: n })} names={OUTFIT_NAMES} />
          <Swatches label={t('avatar.outfit_color')} palettes={OUTFIT_COLORS} value={avatar.outfitColor} onChange={set('outfitColor')} />
          <Swatches label={t('avatar.skin')} palettes={SKIN_TONES} value={avatar.skin} onChange={set('skin')} />
        </section>

        <section className="panel options-panel pet-panel">
          <fieldset className="option-group">
            <legend>{t('pet.title')}</legend>
            <div className="style-grid">
              <button type="button" className={`style-option pet-option ${!pet.type ? 'selected' : ''}`} onClick={() => setPet({ type: null })} aria-pressed={!pet.type}>
                <span className="pixel no-pet">{t('pet.none')}</span>
              </button>
              {PETS.map((p) => {
                const locked = user.level < p.level;
                return (
                  <button
                    key={p.key}
                    type="button"
                    className={`style-option pet-option ${pet.type === p.key ? 'selected' : ''} ${locked ? 'locked' : ''}`}
                    onClick={() => !locked && setPet({ type: p.key })}
                    disabled={locked}
                    aria-pressed={pet.type === p.key}
                    title={locked ? t('pet.unlock', { lv: p.level }) : p.name}
                  >
                    <Pet pet={{ type: p.key, color: pet.type === p.key ? pet.color : 'cream' }} size={48} title="" />
                    <span className="pixel pet-label">{locked ? `Lv.${p.level}` : p.name}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {pet.type && (
            <>
              <Swatches label={t('pet.color')} palettes={petPalettes(pet.type)} value={pet.color} onChange={(c) => setPet({ color: c })} />
              <div className="field">
                <label htmlFor="pet-name">{t('pet.name')}</label>
                <input id="pet-name" className="input" maxLength={20} value={pet.name ?? ''} onChange={(e) => setPet({ name: e.target.value })} placeholder={t('pet.name_ph')} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
