// Recolour the hand-drawn layers and stack them into one 32x32 image (data URL).
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, normalizeAvatar } from './parts.js';

const KEY_GREYS = ['#d9d9d9', '#a6a6a6', '#737373']; // light, base, shadow
const SIZE = 32;
const BASE = `${import.meta.env?.BASE_URL ?? '/'}avatar/`;

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const KEYS = KEY_GREYS.map(hexToRgb);

const imageCache = new Map();
const resultCache = new Map();

function loadImage(name) {
  if (!imageCache.has(name)) {
    imageCache.set(
      name,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Missing avatar part: ${name}`));
        img.src = `${BASE}${name}.png`;
      }),
    );
  }
  return imageCache.get(name);
}

// swap the 3 key greys for a palette, in place
function recolor(pixels, palette) {
  const to = palette.map(hexToRgb);
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    for (let k = 0; k < 3; k++) {
      const [r, g, b] = KEYS[k];
      if (pixels[i] === r && pixels[i + 1] === g && pixels[i + 2] === b) {
        [pixels[i], pixels[i + 1], pixels[i + 2]] = to[k];
        break;
      }
    }
  }
}

/** avatar JSON -> Promise<dataURL> */
export function composeAvatar(avatar) {
  const a = normalizeAvatar(avatar);
  const key = JSON.stringify(a);
  if (resultCache.has(key)) return resultCache.get(key);

  const layers = [
    ['body', SKIN_TONES[a.skin]],
    [`outfit-${a.outfit}`, OUTFIT_COLORS[a.outfitColor]],
    [`hair-${a.hair}`, HAIR_COLORS[a.hairColor]],
  ];

  const job = Promise.all(layers.map(([name]) => loadImage(name))).then((images) => {
    const out = document.createElement('canvas');
    out.width = out.height = SIZE;
    const outCtx = out.getContext('2d');
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = SIZE;
    const ctx = tmp.getContext('2d', { willReadFrequently: true });

    images.forEach((img, i) => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const data = ctx.getImageData(0, 0, SIZE, SIZE);
      recolor(data.data, layers[i][1]);
      ctx.putImageData(data, 0, 0);
      outCtx.drawImage(tmp, 0, 0);
    });
    return out.toDataURL();
  });

  resultCache.set(key, job);
  job.catch(() => resultCache.delete(key));
  return job;
}
