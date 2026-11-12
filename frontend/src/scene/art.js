// Paths to August's hand-drawn art in public/ (64x64 PNGs).
const BASE = import.meta.env?.BASE_URL ?? '/';

/**
 * stage 1 = seedling, 2 = growing, 3 = grown
 * bitten = a boss is nibbling it (only stages 1–2 have this)
 * win = boss rooms only, after the pest is defeated or the mission succeeded (stage 3 only)
 */
export function treeArt(type, stage, { bitten = false, win = false } = {}) {
  const t = ['cactus', 'sakura', 'mushroom'].includes(type) ? type : 'cactus';
  let suffix = '';
  if (stage === 3 && win) suffix = '-win';
  else if (stage < 3 && bitten) suffix = '-bitten';
  return `${BASE}trees/${t}-${stage}${suffix}.png`;
}

/** which tree stage to show for a room */
export function treeStageFor(status, progress) {
  if (status === 'waiting') return 1;
  if (progress >= 75) return 3;
  if (progress >= 35) return 2;
  return 1;
}

export const BOSS_ART = {
  idle: `${BASE}boss/idle.png`,
  hit: `${BASE}boss/hit.png`,
  weak: `${BASE}boss/weak.png`, // HP below 30%
  dead: `${BASE}boss/dead.png`,
};

// preload so frames don't flicker the first time they swap
if (typeof Image !== 'undefined') {
  Object.values(BOSS_ART).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

// ---------- backgrounds (public/bg, WebP; "-sm" = 800px wide for phones) ----------
const NORMAL_SCENES = ['normal-1', 'normal-2'];
const BOSS_SCENES = ['boss-1', 'boss-2', 'boss-3', 'boss-4'];

const bgVars = (name) => ({
  '--scene-bg': `url(${BASE}bg/${name}.webp)`,
  '--scene-bg-sm': `url(${BASE}bg/${name}-sm.webp)`,
});

/** Each room always gets the same background, picked from its id. */
export function roomBackground(room) {
  const list = room.boss_id ? BOSS_SCENES : NORMAL_SCENES;
  return bgVars(list[Math.abs(Number(room.id) || 0) % list.length]);
}

