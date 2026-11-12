// Game rules shared by the room screen and the mock backend. The Yii2 API must follow the same numbers
// (components/Rules.php in the Yii project). Every result is a whole number: anything that divides rounds UP.

export const MIN_DURATION = 15; // minutes, every room
export const MAX_DURATION = 180; // normal rooms
export const MAX_BOSS_DURATION = 360; // boss rooms can run long (a 320 HP pest takes 320 minutes solo)
export const BOSS_MIN_LEVEL = 30; // create or join a boss room
export const EARLY_LEAVE_PENALTY = 2; // leaving before half of the session
export const HARVEST_BONUS = 10; // normal rooms of 60+ minutes
export const LONG_ROOM_MINUTES = 60;
export const LUCKY_CHANCE = 0.2; // shorter rooms: 1 in 5 rooms gets a random 1–10 bonus

/** EXP for focused minutes: half, rounded up (25 min -> 13, 60 min -> 30) */
export const focusExp = (minutes) => Math.ceil(Math.max(0, minutes) / 2);

/** harvest bonus of a normal room, rolled once when the room is created */
export function rollHarvestBonus(durationMinutes, random = Math.random) {
  if (durationMinutes >= LONG_ROOM_MINUTES) return HARVEST_BONUS;
  return random() < LUCKY_CHANCE ? 1 + Math.floor(random() * HARVEST_BONUS) : 0;
}

/** bonus when the pest dies: 1 per 10 minutes (rounded up), doubled from 100 minutes (40 -> 4, 160 -> 32) */
export function bossBonus(minutes) {
  const base = Math.ceil(Math.max(0, minutes) / 10);
  return minutes >= 100 ? base * 2 : base;
}

// Tree stages: 1 seedling, 2 growing, 3 grown, 4 boss win.
// The last stage only appears at the real finish (session completed / pest dead); the time (or HP) before
// that is split evenly between the other stages.

/** normal room: 2 stages before the finish -> grows at half the duration */
export function normalStage(focusedMinutes, durationMinutes, completed) {
  if (completed) return 3;
  return focusedMinutes >= Math.ceil(durationMinutes / 2) ? 2 : 1;
}

/** boss room: 3 stages before the pest dies -> grows every HP/3 (320 HP: at 107 and 214 damage) */
export function bossStage(damage, maxHp) {
  if (damage >= maxHp) return 4;
  if (damage >= Math.ceil((maxHp * 2) / 3)) return 3;
  if (damage >= Math.ceil(maxHp / 3)) return 2;
  return 1;
}

// ---------- optional breaks ----------
// The host may set "break for B minutes after every E focused minutes" — only in rooms of 50+ minutes,
// E must be shorter than the room, B is at most 20. Breaks don't count as focus:
// no EXP, no tree growth, no boss damage. The schedule is fixed from the start, so everyone can work it out
// from started_at alone:  focus E | break B | focus E | break B | ... | last focus block (no break after it).
export const MAX_BREAK = 20;
export const MIN_BREAK_ROOM = 50; // shorter rooms can't have breaks
export const BREAK_EVERY_OPTIONS = [20, 25, 30, 45, 50, 60, 90, 120];
export const BREAK_LENGTH_OPTIONS = [5, 10, 15, 20];
/** "break every" choices for a room of this length (must be shorter than the room) */
export const breakEveryOptions = (duration) => BREAK_EVERY_OPTIONS.filter((n) => n < duration);

const hasBreaks = (every, brk) => Number(every) > 0 && Number(brk) > 0;

/** number of breaks in a session */
export function breakCount(duration, every, brk) {
  return hasBreaks(every, brk) ? Math.max(0, Math.ceil(duration / every) - 1) : 0;
}

/** minutes from start to end, breaks included */
export const sessionMinutes = (duration, every, brk) => duration + breakCount(duration, every, brk) * (Number(brk) || 0);

/** wall-clock ms since the start -> focused ms (break time removed) */
export function focusMsAt(wallMs, every, brk) {
  const wall = Math.max(0, wallMs);
  if (!hasBreaks(every, brk)) return wall;
  const f = every * 60_000;
  const cycle = f + brk * 60_000;
  const n = Math.floor(wall / cycle);
  return n * f + Math.min(wall - n * cycle, f);
}

/** ms left of the current break, or 0 while focusing */
export function breakLeftMs(wallMs, duration, every, brk) {
  if (!hasBreaks(every, brk) || wallMs < 0) return 0;
  const f = every * 60_000;
  const cycle = f + brk * 60_000;
  const rem = wallMs % cycle;
  if (rem < f || focusMsAt(wallMs, every, brk) >= duration * 60_000) return 0;
  return cycle - rem;
}
