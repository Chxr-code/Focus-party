// Pixel sprites drawn as text. Each letter = one pixel colour from the palette.
// To tweak a sprite, just edit the letters. Keep every row the same length.

const SOIL = { D: '#8a5a33', d: '#5e3a1f' };
const soilRows = ['..dDDDDDDd..', '...dddddd...'];

// ---------- decoration ----------
export const PINE = {
  palette: { G: '#2f6b3a', g: '#4f9a4c', T: '#b5532f', t: '#7a3420' },
  grid: [
    '.....GG.....',
    '....GGgG....',
    '...GGgGGG...',
    '....GGGG....',
    '...GGGGgG...',
    '..GGgGGGGG..',
    '....GGGG....',
    '..GGGGGgGG..',
    '.GGgGGGGGGG.',
    'GGGGGGGgGGGG',
    '..GGGGGGGG..',
    '.GGGgGGGGGG.',
    'GGGGGGGGGgGG',
    '.....TT.....',
    '.....TT.....',
    '....tTTt....',
  ],
};

export const BUSH = {
  palette: { G: '#3f7f3a', g: '#5fae4f', F: '#ffd84a' },
  grid: [
    '..gGGg..',
    '.GGgFGG.',
    'GgGGGGgG',
    'GGGgGGGG',
    '.GGGGgG.',
  ],
};

export const ROCK = {
  palette: { S: '#8f9aa6', s: '#6b7682', w: '#b8c2cc' },
  grid: [
    '..wwSS..',
    '.wSSSSs.',
    'SSSSSsss',
    '.sssss..',
  ],
};

// ---------- campfire (2 frames for flicker) ----------
const fireTop = [
  '.....Y......',
  '....YOY.....',
  '...YORO.Y...',
  '...ORRROO...',
  '..YORRRRO...',
  '..ORRYRRO...',
];
const fireBottom = [
  '..wWWWWWWw..',
  '.SwWwWwWwWS.',
  '.SS......SS.',
];
export const CAMPFIRE = {
  palette: { Y: '#ffe066', O: '#ff9a3c', R: '#e5534b', W: '#8a5a33', w: '#5e3a1f', S: '#9aa3ab' },
  frames: [
    [...fireTop, ...fireBottom],
    [...fireTop.map((r) => [...r].reverse().join('')), ...fireBottom],
  ],
};

// ---------- room trees: 3 stages each (0 seedling, 1 growing, 2 bloom) ----------
const SPROUT = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '......L.....',
  '....LLL.L...',
  '.....LLL....',
  '......S.....',
  '......S.....',
  ...soilRows,
];
const sproutPalette = { ...SOIL, L: '#6cc24a', S: '#3f8a3a' };

export const TREE_SPRITES = {
  cactus: {
    palette: { ...SOIL, ...sproutPalette, C: '#4caf50', c: '#2e7d32', P: '#f78fb3', Y: '#ffe066' },
    stages: [
      SPROUT,
      [
        '............',
        '............',
        '............',
        '.....CC.....',
        '.....Cc.....',
        '..C..CC.....',
        '..CC.CC..C..',
        '...CCCc.CC..',
        '.....CCCC...',
        '.....cC.....',
        ...soilRows,
      ],
      [
        '.....PP.....',
        '....PYYP....',
        '.....CC.....',
        '.....cC.....',
        '..C..CC.....',
        '..CC.Cc..C..',
        '..cC.CC..CC.',
        '...CCCC.CC..',
        '.....CCCC...',
        '.....cC.....',
        ...soilRows,
      ],
    ],
  },
  sakura: {
    palette: { ...SOIL, ...sproutPalette, G: '#5aa64a', g: '#3f8a3a', P: '#f7a8c8', p: '#e26fa0', T: '#7a4a2a' },
    stages: [
      SPROUT,
      [
        '............',
        '............',
        '....GGGG....',
        '...GGgGGG...',
        '...GGGGgG...',
        '....GGGG....',
        '......T.....',
        '.....TT.....',
        '......T.....',
        '......T.....',
        ...soilRows,
      ],
      [
        '...PPpPPP...',
        '..PPPPPpPP..',
        '.PPpPPPPPPP.',
        '.PPPPPpPPPP.',
        '..PPPPPPpP..',
        '....PPTPP...',
        '......TT....',
        '.....TT.....',
        '......T.....',
        '......T.....',
        ...soilRows,
      ],
    ],
  },
  mushroom: {
    palette: { ...SOIL, ...sproutPalette, R: '#d64545', w: '#fff3e0', W: '#f1e3c8', Y: '#ffe066' },
    stages: [
      SPROUT,
      [
        '............',
        '............',
        '............',
        '............',
        '............',
        '....RRRR....',
        '...RRwRRR...',
        '...RRRRwR...',
        '.....WW.....',
        '.....WW.....',
        ...soilRows,
      ],
      [
        '..Y......Y..',
        '...RRRRRR...',
        '..RRwRRRwRR.',
        '.RRRRRRRRRRR',
        '.RwRRRwRRRwR',
        '..RRRRRRRRR.',
        '.....WWW....',
        '.....WWW..Y.',
        '..Y..WWW....',
        '.....WWW....',
        ...soilRows,
      ],
    ],
  },
};

/** 0 = seedling, 1 = growing, 2 = bloomed */
export function treeStage(room) {
  if (room.bloomed) return 2;
  if (room.status === 'waiting') return 0;
  return room.tree_progress >= 40 ? 1 : 0;
}
