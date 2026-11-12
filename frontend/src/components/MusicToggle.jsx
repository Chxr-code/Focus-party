import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n.jsx';

// Background music for the whole site. The speaker button opens a small panel: on/off + volume.
// Browsers block sound until the visitor clicks something, so music starts on the first click/tap.
const KEY = 'focusparty_music';
const VOL_KEY = 'focusparty_volume';
const SRC = `${import.meta.env.BASE_URL}audio/bgm.mp3`;

const load = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

// Pixel speaker drawn on a 12×10 grid: waves for the volume, an X when muted.
function SpeakerIcon({ level }) {
  const px = (x, y, w = 1, h = 1) => <rect key={`${x},${y},${w},${h}`} x={x} y={y} width={w} height={h} />;
  const body = [px(0, 3, 2, 4), px(2, 2, 1, 6), px(3, 1, 1, 8), px(4, 0, 1, 10)];
  const waves = level === 0
    ? [px(7, 3), px(8, 4), px(9, 5), px(10, 6), px(10, 3), px(9, 4), px(8, 5), px(7, 6)]
    : [
        px(6, 4, 1, 2),
        ...(level >= 34 ? [px(8, 2), px(9, 3, 1, 4), px(8, 7)] : []),
        ...(level >= 67 ? [px(10, 0), px(11, 1, 1, 8), px(10, 9)] : []),
      ];
  return (
    <svg className="speaker-ico" viewBox="0 0 12 10" width="18" height="15" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      {body}
      {waves}
    </svg>
  );
}

export default function MusicToggle() {
  const { t } = useT();
  const audio = useRef(null);
  const wrap = useRef(null);
  const [on, setOn] = useState(() => load(KEY, 'on') !== 'off');
  const [volume, setVolume] = useState(() => Number(load(VOL_KEY, 35)));
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const a = new Audio(SRC);
    a.loop = true;
    a.preload = 'none';
    a.addEventListener('play', () => setPlaying(true));
    a.addEventListener('pause', () => setPlaying(false));
    audio.current = a;
    return () => a.pause();
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.volume = volume / 100;
  }, [volume]);

  // start on the first interaction anywhere on the page
  useEffect(() => {
    if (!on || playing) return undefined;
    const start = () => audio.current?.play().catch(() => {});
    start();
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, [on, playing]);

  // close the panel when clicking elsewhere
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  function setEnabled(next) {
    setOn(next);
    save(KEY, next ? 'on' : 'off');
    if (next) audio.current?.play().catch(() => {});
    else audio.current?.pause();
  }

  function changeVolume(v) {
    setVolume(v);
    save(VOL_KEY, v);
    if (v > 0 && !on) setEnabled(true);
  }

  return (
    <div className="music" ref={wrap}>
      <button
        type="button"
        className={`btn small ${on ? 'gold' : 'ghost'}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('top.volume')}
        title={on ? t('top.music_on') : t('top.music_off')}
      >
        <SpeakerIcon level={!on ? 0 : volume} />
      </button>
      {open && (
        <div className="panel music-panel">
          <label className="music-switch">
            <input type="checkbox" checked={on} onChange={(e) => setEnabled(e.target.checked)} />
            <span>{on ? t('top.music_on') : t('top.music_off')}</span>
          </label>
          <label className="music-volume">
            <span className="pixel">{t('top.volume')}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-valuetext={`${volume}%`}
            />
            <span className="pixel vol-num">{volume}%</span>
          </label>
        </div>
      )}
    </div>
  );
}
