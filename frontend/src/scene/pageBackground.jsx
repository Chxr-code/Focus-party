import { useEffect } from 'react';

// Full-page backgrounds (public/bg). Name text comes from i18n: t(`bg.${key}`)
export const PAGE_BACKGROUNDS = {
  forest: { file: 'web' }, // Background.png
  dark: { file: 'web-2' }, // Background-2.png
  ruins: { file: 'web-3' },
  candy: { file: 'web-4' },
  dusk: { file: 'web-5' },
  city: { file: 'web-6' },
};
export const THEME_KEYS = Object.keys(PAGE_BACKGROUNDS);

const BASE = import.meta.env?.BASE_URL ?? '/';
export const bgThumb = (key) => `${BASE}bg/${(PAGE_BACKGROUNDS[key] ?? PAGE_BACKGROUNDS.forest).file}-sm.webp`;

/** Room theme chosen by the host, or the default: dark forest for boss rooms, sunny forest otherwise. */
export function roomTheme(room) {
  if (room?.theme && PAGE_BACKGROUNDS[room.theme]) return room.theme;
  return room?.boss_id ? 'dark' : 'forest';
}

/** Switch the fixed page background while this page is open. */
export function usePageBackground(key = 'forest') {
  useEffect(() => {
    const bg = PAGE_BACKGROUNDS[key] ?? PAGE_BACKGROUNDS.forest;
    const root = document.documentElement.style;
    root.setProperty('--page-bg', `url(${BASE}bg/${bg.file}.webp)`);
    root.setProperty('--page-bg-sm', `url(${BASE}bg/${bg.file}-sm.webp)`);
  }, [key]);
}

// Page background choices (garden, lobby) are per-browser preferences
export function loadBackground(page) {
  try {
    const v = localStorage.getItem(`focusparty_${page}_bg`);
    return v in PAGE_BACKGROUNDS ? v : 'forest';
  } catch {
    return 'forest';
  }
}

export function saveBackground(page, key) {
  try {
    localStorage.setItem(`focusparty_${page}_bg`, key);
  } catch {
    /* ignore */
  }
}
export const loadGardenBackground = () => loadBackground('garden');
export const saveGardenBackground = (key) => saveBackground('garden', key);

/** Row of background thumbnails (garden picker + room theme picker). */
export function ThemePicker({ value, onChange, t, label }) {
  return (
    <div className="theme-picker" role="radiogroup" aria-label={label}>
      {THEME_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          className={`theme-option ${value === key ? 'selected' : ''}`}
          style={{ backgroundImage: `url(${bgThumb(key)})` }}
          onClick={() => onChange(key)}
          title={t(`bg.${key}`)}
        >
          <span className="pixel">{t(`bg.${key}`)}</span>
        </button>
      ))}
    </div>
  );
}
