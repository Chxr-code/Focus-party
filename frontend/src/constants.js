// Must match the backend rules (TREE_UNLOCKS in mock.js / Yii2 API)
export const TREES = {
  cactus: { name: 'Cactus', unlockLevel: 1 },
  sakura: { name: 'Sakura', unlockLevel: 3 },
  mushroom: { name: 'Magic Mushroom', unlockLevel: 5 },
};

export const DURATION_PRESETS = [15, 25, 50, 60, 90]; // minimum is 15 (rules.js)
export const EXP_PER_LEVEL = 100;
export const MAX_LEVEL = 60; // Lv.60 = 5,900 EXP
