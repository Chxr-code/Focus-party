// Garden tree life rules — the backend uses the same numbers (models/Garden.php + components/Rules.php).
//
// A tree dies if it isn't watered for:  seedling 1 month · growing 2 months · grown 3 months · boss-win 6 months
// A dead tree comes back after being watered on 5 different days within 30 days
// (the 30 days start at the first watering after it died; miss the window and the count starts again).

const DAY = 86_400_000;
export const LIFE_DAYS = { 1: 30, 2: 60, 3: 90, win: 180 };
export const REVIVE_WATERINGS = 5;
export const REVIVE_WINDOW_DAYS = 30;

/** 1 | 2 | 3 | 'win' — which art and which lifespan a garden tree has */
export function treeKind(entry) {
  // new API: the stage the player took home (1 seedling, 2 growing, 3 grown, 4 boss win)
  if (entry.tree_stage != null) return Number(entry.tree_stage) >= 4 ? 'win' : Math.max(1, Number(entry.tree_stage));
  if (entry.bloomed) return entry.boss_id ? 'win' : 3;
  return (entry.tree_progress ?? 0) >= 35 ? 2 : 1;
}

const ms = (iso) => (iso ? new Date(iso).getTime() : null);

export function lastWatered(entry) {
  return ms(entry.last_watered_at) ?? ms(entry.finished_at) ?? Date.now();
}

export function isDead(entry, now = Date.now()) {
  return now - lastWatered(entry) > LIFE_DAYS[treeKind(entry)] * DAY;
}

/** days left before a living tree dies (0 = today) */
export function daysLeft(entry, now = Date.now()) {
  return Math.max(0, Math.ceil((lastWatered(entry) + LIFE_DAYS[treeKind(entry)] * DAY - now) / DAY));
}

/** revive progress of a dead tree, or null when no revive is running */
export function reviveState(entry, now = Date.now()) {
  const start = ms(entry.revive_started_at);
  if (!start || now - start > REVIVE_WINDOW_DAYS * DAY) return { count: 0, daysLeft: REVIVE_WINDOW_DAYS };
  return {
    count: entry.revive_count ?? 0,
    daysLeft: Math.max(0, Math.ceil((start + REVIVE_WINDOW_DAYS * DAY - now) / DAY)),
  };
}

const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

/**
 * Apply one watering to a tree (used by the mock backend; the real backend does the same).
 * Returns the updated tree.
 */
export function water(entry, now = Date.now()) {
  if (!isDead(entry, now)) {
    return { ...entry, last_watered_at: new Date(now).toISOString(), revive_count: 0, revive_started_at: null, revive_last_day: null };
  }
  const start = ms(entry.revive_started_at);
  const fresh = !start || now - start > REVIVE_WINDOW_DAYS * DAY;
  if (fresh) {
    return { ...entry, revive_started_at: new Date(now).toISOString(), revive_count: 1, revive_last_day: dayKey(now) };
  }
  if (entry.revive_last_day === dayKey(now)) return entry; // already counted today
  const count = (entry.revive_count ?? 0) + 1;
  if (count >= REVIVE_WATERINGS) {
    // back to life!
    return { ...entry, last_watered_at: new Date(now).toISOString(), revive_count: 0, revive_started_at: null, revive_last_day: null };
  }
  return { ...entry, revive_count: count, revive_last_day: dayKey(now) };
}

// ---------- garden themes (scene backgrounds), unlocked by level ----------
export const GARDEN_THEMES = [
  { key: 'pond', n: 1, level: 1 },
  { key: 'hideout', n: 2, level: 3 },
  { key: 'autumn', n: 3, level: 5 },
  { key: 'farm', n: 4, level: 8 },
];

const BASE = import.meta.env?.BASE_URL ?? '/';
/** background for section i of a garden (section 0 has the sign, the rest continue to the right) */
export function gardenSection(themeKey, i) {
  const theme = GARDEN_THEMES.find((t) => t.key === themeKey) ?? GARDEN_THEMES[0];
  const name = `garden${theme.n}-${i === 0 ? 1 : 2}`;
  return { lg: `${BASE}bg/${name}.webp`, sm: `${BASE}bg/${name}-sm.webp` };
}

// soil plots (same layout in every theme): centre x / y in % of one section
export const PLOTS = [38.0, 56.1, 74.3].flatMap((y) => [19.5, 39.9, 60.2, 80.4].map((x) => ({ x, y })));
