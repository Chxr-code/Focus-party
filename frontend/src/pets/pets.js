// Pets. Art lives in public/pets/<key>.png (16×16, bottom-aligned). Recolourable parts use the same 3 key greys as
// the avatar (#d9d9d9 / #a6a6a6 / #737373); anything else (outline, eyes, Olivia's shirt + flower) keeps its colour.
//
// The chosen pet is stored inside the avatar JSON, so no extra backend column is needed:
//   avatar.pet = { type: 'cat', color: 'pink', name: 'Mochi' }   (type null = no pet)

export const PETS = [
  { key: 'beebot', name: 'Bee bot', level: 2 },
  { key: 'bunnybot', name: 'Bunny bot', level: 2 },
  { key: 'cloudy', name: 'Cloudy', level: 5 },
  { key: 'beebunny', name: 'Bee bunny', level: 10 },
  { key: 'cat', name: 'Cat', level: 15 },
  { key: 'olivia', name: 'Olivia', level: 22 },
];

// [light, base, shadow]
export const PET_COLORS = {
  cream: ['#fff7e0', '#f2deb0', '#c9ab72'],
  pink: ['#ffd0e3', '#f48fb8', '#c25784'],
  sky: ['#cfe8ff', '#8cc4ff', '#4f87c9'],
  mint: ['#d4f7e6', '#8fdcb7', '#4fa17c'],
  lilac: ['#ead9ff', '#c2a2f0', '#8a68bd'],
  honey: ['#fff0a0', '#ffcf4a', '#c98f12'],
  grey: ['#f0f0f4', '#b8bcc8', '#7d8292'],
  cocoa: ['#d9a77f', '#9c6a45', '#6b4429'],
};

// Per-pet tweaks: Olivia's sky-blue hair reads too pale next to her skin, so hers is a deeper blue.
const PET_COLOR_OVERRIDES = {
  olivia: { sky: ['#7fb2ee', '#3f72c4', '#264e94'] },
};
/** colour palettes for one pet type (the shared set + that pet's overrides) */
export const petPalettes = (type) => ({ ...PET_COLORS, ...(PET_COLOR_OVERRIDES[type] ?? {}) });

export const petInfo = (key) => PETS.find((p) => p.key === key) ?? null;

const KEY_GREYS = ['#d9d9d9', '#a6a6a6', '#737373'].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const cache = new Map();

/** pet {type, color} -> Promise<dataURL> */
export function composePet(pet) {
  if (!pet?.type || !petInfo(pet.type)) return Promise.resolve(null);
  const palettes = petPalettes(pet.type);
  const palette = palettes[pet.color] ?? palettes.cream;
  const key = `${pet.type}|${pet.color}`;
  if (cache.has(key)) return cache.get(key);

  const job = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const px = data.data;
      const to = palette.map(hexToRgb);
      for (let i = 0; i < px.length; i += 4) {
        if (!px[i + 3]) continue;
        for (let k = 0; k < 3; k++) {
          const [r, g, b] = KEY_GREYS[k];
          if (px[i] === r && px[i + 1] === g && px[i + 2] === b) {
            [px[i], px[i + 1], px[i + 2]] = to[k];
            break;
          }
        }
      }
      ctx.putImageData(data, 0, 0);
      resolve(c.toDataURL());
    };
    img.onerror = () => reject(new Error(`Missing pet art: ${pet.type}`));
    img.src = `${import.meta.env.BASE_URL}pets/${pet.type}.png`;
  });
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}
