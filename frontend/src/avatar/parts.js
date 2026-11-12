// August's hand-drawn avatar parts (public/avatar/*.png, 32x32).
// Every recolourable pixel uses one of 3 key greys; outlines/eyes (#3B2417) never change.
//
// Avatar JSON stored in users.avatar:
//   { hair: 1-4, hairColor: 'brown', outfit: 1-5, outfitColor: 'blue', skin: 'light' }

export const HAIR_STYLES = [1, 2, 3, 4];
export const OUTFITS = [1, 2, 3, 4, 5];
export const OUTFIT_NAMES = { 1: 'T-shirt', 2: 'Button tee', 3: 'Dress', 4: 'Skirt', 5: 'Overalls' };

// each palette = [light, base, shadow]
export const HAIR_COLORS = {
  black: ['#5a5a6e', '#33333f', '#1c1c24'],
  brown: ['#c98d5f', '#8a5a33', '#5e3a1f'],
  blonde: ['#fff0a8', '#f2cf5b', '#c9982a'],
  ginger: ['#ffb37a', '#e07a3a', '#a84f1f'],
  pink: ['#ffc2dd', '#f07fb0', '#b84a7c'],
  lilac: ['#e2ccff', '#b48ae8', '#7d58b3'],
  mint: ['#c4f5dc', '#6fd1a3', '#3c9a70'],
  silver: ['#f4f4f8', '#cfd2dc', '#9a9eab'],
};

export const OUTFIT_COLORS = {
  blue: ['#9fd0ff', '#59a7ff', '#2f6fc4'],
  red: ['#ff9f99', '#e5534b', '#9e2d2a'],
  green: ['#a8e08f', '#5fae4f', '#3f7f3a'],
  yellow: ['#fff0a0', '#ffcf4a', '#c98f12'],
  purple: ['#d2b8ff', '#9a6ee0', '#6a43a8'],
  pink: ['#ffd0e3', '#f48fb8', '#c25784'],
  white: ['#ffffff', '#ece7dc', '#bdb5a5'],
  navy: ['#6f7fb8', '#3d4a80', '#232c55'],
};

export const SKIN_TONES = {
  light: ['#ffeedd', '#ffd9bd', '#f0b48f'],
  peach: ['#ffe3cc', '#f5c6a0', '#d99a73'],
  tan: ['#e8b48a', '#c98d5f', '#9a6440'],
  brown: ['#b98058', '#8d5a3b', '#653d26'],
  deep: ['#8a5a3c', '#5e3b26', '#3f2618'],
};

const pick = (list, n) => list[n % list.length];

/** Build a full avatar from any input — old {seed} data, partial data, or nothing. */
export function normalizeAvatar(avatar = {}) {
  const seed = String(avatar?.seed ?? 'player');
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const valid = (v, list) => (list.includes(v) ? v : null);
  return {
    hair: valid(Number(avatar?.hair), HAIR_STYLES) ?? pick(HAIR_STYLES, h),
    hairColor: avatar?.hairColor in HAIR_COLORS ? avatar.hairColor : pick(Object.keys(HAIR_COLORS), h >> 3),
    outfit: valid(Number(avatar?.outfit), OUTFITS) ?? pick(OUTFITS, h >> 6),
    outfitColor: avatar?.outfitColor in OUTFIT_COLORS ? avatar.outfitColor : pick(Object.keys(OUTFIT_COLORS), h >> 9),
    skin: avatar?.skin in SKIN_TONES ? avatar.skin : pick(Object.keys(SKIN_TONES), h >> 12),
  };
}

export function randomAvatar() {
  const r = (list) => list[Math.floor(Math.random() * list.length)];
  return {
    hair: r(HAIR_STYLES),
    hairColor: r(Object.keys(HAIR_COLORS)),
    outfit: r(OUTFITS),
    outfitColor: r(Object.keys(OUTFIT_COLORS)),
    skin: r(Object.keys(SKIN_TONES)),
  };
}
