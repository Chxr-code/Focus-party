// In-browser fake backend that follows the same API contract and game rules as the Yii2 API.
// Data is kept in localStorage so it survives page refresh. Use mockDebug.reset() to start over.
//
// Test accounts (all use password "password123"):
//   august (Lv.3), mint (Lv.1), ploy (Lv.32), ken (Lv.2) · admin / admin123 (Lv.30, admin tools)
//
// Tip: set VITE_MOCK_MINUTE_MS=1000 in .env so "1 minute" in the game = 1 real second.

import { ApiError, getToken } from './shared.js';
import { GARDEN_THEMES, water as waterTree } from '../garden/life.js';
import {
  BOSS_MIN_LEVEL, EARLY_LEAVE_PENALTY, MAX_BOSS_DURATION, MAX_DURATION, MIN_DURATION,
  MAX_BREAK, MIN_BREAK_ROOM, bossBonus, bossStage, focusExp, focusMsAt, normalStage, rollHarvestBonus, sessionMinutes,
} from '../rules.js';

const env = import.meta.env ?? {};
const MINUTE_MS = Number(env.VITE_MOCK_MINUTE_MS) || 60_000;
const CLAIM_WINDOW_MS = 10 * 60_000; // always 10 real minutes, like the real API
const STORAGE_KEY = 'focusparty_mock_db_v9'; // bump to reset old saved mock data
export const MOCK_PASSWORD = 'password123';

export const TREE_UNLOCKS = { cactus: 1, sakura: 3, mushroom: 5 };

// ---------- helpers ----------
const MAX_LEVEL = 60;
const levelOf = (exp) => Math.min(MAX_LEVEL, Math.floor(exp / 100) + 1);
const unlockedTrees = (level) =>
  Object.entries(TREE_UNLOCKS)
    .filter(([, lv]) => level >= lv)
    .map(([tree]) => tree);
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
const delay = () => new Promise((r) => setTimeout(r, 150 + Math.random() * 200));
const clone = (x) => JSON.parse(JSON.stringify(x));
const fail = (status, message, errors = {}) => {
  throw new ApiError(status, message, errors);
};

// ---------- database ----------
function seed() {
  const now = Date.now();
  const m = MINUTE_MS;
  const day = 86_400_000;

  const users = [
    { id: 1, username: 'august', password: MOCK_PASSWORD, display_name: 'August', avatar: { hair: 3, hairColor: 'brown', outfit: 3, outfitColor: 'green', skin: 'peach' }, exp: 250 },
    { id: 2, username: 'mint', password: MOCK_PASSWORD, display_name: 'Mint', avatar: { hair: 2, hairColor: 'mint', outfit: 1, outfitColor: 'white', skin: 'light' }, exp: 40 },
    { id: 3, username: 'ploy', password: MOCK_PASSWORD, display_name: 'Ploy', avatar: { hair: 4, hairColor: 'pink', outfit: 5, outfitColor: 'navy', skin: 'tan' }, exp: 3100 },
    { id: 5, username: 'admin', password: 'admin123', display_name: 'Admin', avatar: { hair: 1, hairColor: 'silver', outfit: 2, outfitColor: 'navy', skin: 'tan' }, exp: 2900, role: 'admin' },
    { id: 4, username: 'ken', password: MOCK_PASSWORD, display_name: 'Ken', avatar: { hair: 1, hairColor: 'black', outfit: 2, outfitColor: 'red', skin: 'brown' }, exp: 120 },
  ];

  const bosses = [
    // boss templates: a boss room copies the HP and fights its OWN pest (nothing is shared between rooms)
    { id: 1, name: 'Baby Pest', topic: 'Any', max_hp: 60, current_hp: 60, created_by: 5, defeated_at: null },
    { id: 2, name: 'Pest Worm', topic: 'Any', max_hp: 120, current_hp: 120, created_by: 5, defeated_at: null },
    { id: 3, name: 'Giant Pest', topic: 'Any', max_hp: 320, current_hp: 320, created_by: 5, defeated_at: null },
  ];

  const room = (o) => {
    const r = { location: null, boss_id: null, started_at: null, ends_at: null, members_at_start: 0, created_at: now - day, bonus_exp: 0, ...o };
    if (r.boss_id) Object.assign(r, bossFields(bosses.find((b) => b.id === r.boss_id)));
    return r;
  };
  const rooms = [
    room({ id: 1, host_id: 3, title: 'Calculus grind', topic: 'Calculus', tree_type: 'mushroom', duration_minutes: 120, max_members: 5, status: 'waiting', boss_id: 1 }),
    room({ id: 2, host_id: 4, title: 'TOEIC reading sprint', topic: 'TOEIC', tree_type: 'cactus', duration_minutes: 25, max_members: 4, status: 'waiting' }),
    room({ id: 3, host_id: 3, title: 'Late night coding', topic: 'Coding', tree_type: 'sakura', duration_minutes: 50, max_members: 5, status: 'running', started_at: now - 15 * m, ends_at: now + 35 * m, members_at_start: 3 }),
    room({ id: 4, host_id: 2, title: 'Chill reading', topic: 'Reading', tree_type: 'cactus', duration_minutes: 30, max_members: 3, status: 'waiting', location: 'Library 3F', bonus_exp: 7 }),
    room({ id: 5, host_id: 1, title: 'Physics review', topic: 'Physics', tree_type: 'sakura', duration_minutes: 25, max_members: 4, status: 'running', started_at: now - 3 * 60 * m, ends_at: now - 3 * 60 * m + 25 * m, members_at_start: 2 }),
    room({ id: 6, host_id: 1, title: 'Morning focus', topic: 'Reading', tree_type: 'cactus', duration_minutes: 25, max_members: 4, status: 'running', started_at: now - day, ends_at: now - day + 25 * m, members_at_start: 2 }),
  ];

  const member = (o) => ({ status: 'joined', focused_seconds: 0, joined_at: now - day, left_at: null, claimed_at: null, ...o });
  const room_members = [
    member({ id: 1, room_id: 1, user_id: 3 }),
    member({ id: 2, room_id: 1, user_id: 5 }),
    member({ id: 3, room_id: 2, user_id: 4 }),
    member({ id: 4, room_id: 2, user_id: 2 }),
    member({ id: 5, room_id: 3, user_id: 3 }),
    member({ id: 6, room_id: 3, user_id: 4 }),
    member({ id: 7, room_id: 3, user_id: 2, status: 'left', focused_seconds: 5 * 60, left_at: now - 10 * m }),
    member({ id: 8, room_id: 4, user_id: 2 }),
    member({ id: 9, room_id: 5, user_id: 1, status: 'completed', focused_seconds: 25 * 60, claimed_at: now - 3 * 60 * m + 26 * m }),
    member({ id: 10, room_id: 5, user_id: 3, status: 'completed', focused_seconds: 25 * 60, claimed_at: now - 3 * 60 * m + 27 * m }),
    member({ id: 11, room_id: 6, user_id: 1, status: 'completed', focused_seconds: 25 * 60, claimed_at: now - day + 26 * m }),
    member({ id: 12, room_id: 6, user_id: 2, status: 'left', focused_seconds: 10 * 60, left_at: now - day + 10 * m }),
  ];

  // past sessions for august so the garden isn't empty in the demo
  const past = [
    ['Grammar drills', 'TOEIC', 'cactus', true, null], ['Essay outline', 'Writing', 'sakura', true, null],
    ['Midterm review', 'Calculus', 'sakura', true, 1], ['Flashcards', 'Japanese', 'cactus', false, null],
    ['Portfolio night', 'Design', 'mushroom', true, null], ['Lab report', 'Physics', 'cactus', true, null],
    ['Listening part 3', 'TOEIC', 'mushroom', true, 2],
    ['Vocab sprint', 'TOEIC', 'sakura', true, null], ['Final project', 'Web', 'cactus', true, null],
    ['Reading club', 'Reading', 'mushroom', false, null], ['Data structures', 'Coding', 'sakura', true, null],
    ['History notes', 'History', 'cactus', true, null], ['Boss rush', 'Calculus', 'cactus', true, 1],
  ];
  // days since each tree was last watered — two of them have died, to show reviving
  const lastWater = [3, 5, 2, 40, 100, 1, 4, 6, 2, 8, 1, 3, 2];
  past.forEach(([title, topic, tree_type, bloomed, boss_id], i) => {
    const id = 100 + i;
    const start = now - (120 - i) * day;
    rooms.push(room({ id, host_id: 1, title, topic, tree_type, duration_minutes: 25, max_members: 4, status: 'running', boss_id, started_at: start, ends_at: start + 25 * m, members_at_start: 1 }));
    room_members.push(member({ id: 200 + i, room_id: id, user_id: 1, status: bloomed ? 'completed' : 'left', focused_seconds: bloomed ? 25 * 60 : 12 * 60, tree_stage: bloomed ? (boss_id ? 4 : 3) : i % 2 ? 2 : 1, last_watered_at: now - lastWater[i] * day, tree_name: i === 2 ? 'Lucky Sakura' : null }));
  });
  // a few trees in ploy's garden for the "visit a friend's garden" demo
  [['Thesis writing', 'sakura'], ['Stats homework', 'mushroom'], ['Morning reading', 'cactus']].forEach(([title, tree_type], i) => {
    const id = 120 + i;
    const start = now - (10 + i) * day;
    rooms.push(room({ id, host_id: 3, title, topic: 'Study', tree_type, duration_minutes: 50, max_members: 4, status: 'running', started_at: start, ends_at: start + 50 * m, members_at_start: 1 }));
    room_members.push(member({ id: 230 + i, room_id: id, user_id: 3, status: 'completed', focused_seconds: 50 * 60, tree_stage: 3, last_watered_at: now - day }));
  });

  // admin's test garden: every tree type at every stage, one dead tree of each kind, one halfway revived
  // (19 trees -> 2 fields, so the scroll can be tested too). 25-min solo rooms: 5/10/25 min focused = stage 1/2/3.
  const FOCUS = { 1: 5 * 60, 2: 10 * 60, 3: 25 * 60, win: 25 * 60 };
  const adminTrees = [];
  ['cactus', 'sakura', 'mushroom'].forEach((tree) => [1, 2, 3, 'win'].forEach((kind) => adminTrees.push({ tree, kind, dry: 1 })));
  // dead: past each kind's limit (seedling 30 / growing 60 / grown 90 / boss win 180 days)
  adminTrees.push({ tree: 'cactus', kind: 1, dry: 35 }, { tree: 'sakura', kind: 2, dry: 65 }, { tree: 'mushroom', kind: 3, dry: 95 }, { tree: 'sakura', kind: 'win', dry: 185 });
  adminTrees.push({ tree: 'cactus', kind: 3, dry: 100, revive: 3, name: 'Revive me' }); // 3/5 waterings done
  adminTrees.push({ tree: 'mushroom', kind: 3, dry: 2, name: 'Admin Shroom' }, { tree: 'sakura', kind: 3, dry: 1, name: 'Test Sakura' });
  adminTrees.forEach(({ tree, kind, dry, revive, name }, i) => {
    const id = 140 + i;
    const start = now - (200 - i) * day;
    rooms.push(room({ id, host_id: 5, title: `Test ${tree} ${kind}`, topic: 'Test', tree_type: tree, duration_minutes: 25, max_members: 4, status: 'running', boss_id: kind === 'win' ? 1 : null, started_at: start, ends_at: start + 25 * m, members_at_start: 1 }));
    room_members.push(member({
      id: 260 + i, room_id: id, user_id: 5, status: kind === 1 || kind === 2 ? 'left' : 'completed', focused_seconds: FOCUS[kind],
      last_watered_at: now - dry * day, tree_name: name ?? null, tree_stage: kind === 'win' ? 4 : kind,
      ...(revive ? { revive_count: revive, revive_started_at: now - 4 * day, revive_last_day: new Date(now - day).toISOString().slice(0, 10) } : {}),
    }));
  });

  // friends: ploy is already august's friend, mint sent august a request, ken doesn't accept requests
  users.forEach((u) => { u.allow_friend_requests = u.username !== 'ken'; u.garden_theme = u.username === 'ploy' ? 'autumn' : 'pond'; });
  const friend_requests = [
    { id: 1, from_id: 3, to_id: 1, status: 'accepted' },
    { id: 2, from_id: 2, to_id: 1, status: 'pending' },
  ];
  rooms.forEach((r) => { r.chat_enabled = r.chat_enabled ?? r.id !== 4; r.theme = r.theme ?? null; });
  const messages = [
    { id: 1, room_id: 1, user_id: 3, body: 'Good luck everyone!', created_at: now - 4 * m },
    { id: 2, room_id: 1, user_id: 4, body: 'Let’s beat that pest!', created_at: now - 3 * m },
  ];

  return { users, bosses, rooms, room_members, friend_requests, messages, tokens: {} };
}

let db = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return seed();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

const nextId = (rows) => rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;

// ---------- game rules ----------
const statusOf = (room, now) => (room.status === 'running' && now >= room.ends_at ? 'finished' : room.status);
const membersOf = (roomId) => db.room_members.filter((m) => m.room_id === roomId);
const activeMembers = (roomId) => membersOf(roomId).filter((m) => m.status !== 'left');

// seconds focused so far (in game time)
function focusSecondsOf(room, member, now) {
  if (member.status !== 'joined') return member.focused_seconds;
  if (!room.started_at) return 0;
  return Math.floor(focusMsSince(room, now) / 1000);
}

// focused game-ms since the room started (break time doesn't count)
function focusMsSince(room, now) {
  const wall = ((Math.min(now, room.ends_at) - room.started_at) / MINUTE_MS) * 60_000;
  return focusMsAt(wall, room.break_every, room.break_minutes);
}

// each boss room fights its own copy of the pest
function bossFields(template) {
  return template ? { boss_name: template.name, boss_max_hp: template.max_hp } : {};
}

// pest damage so far: 1 per focused minute per player (whole minutes only)
function bossDamage(room, now) {
  if (!room.boss_id || !room.started_at) return 0;
  return membersOf(room.id).reduce((sum, m) => sum + Math.floor(focusSecondsOf(room, m, now) / 60), 0);
}
const bossHpOf = (room, now) => Math.max(0, room.boss_max_hp - bossDamage(room, now));

/** the tree in the middle of the room (rules.js) */
function roomStage(room, now) {
  if (!room.started_at) return 1;
  if (room.boss_id) return bossStage(bossDamage(room, now), room.boss_max_hp);
  const elapsed = Math.floor(focusMsSince(room, now) / 60_000);
  const finished = statusOf(room, now) === 'finished';
  const someoneStayed = membersOf(room.id).some((m) => m.status !== 'left');
  return normalStage(elapsed, room.duration_minutes, finished && someoneStayed);
}

/** the tree one player takes home when they leave or harvest */
function memberStage(room, member, now, completed) {
  if (room.boss_id) return bossStage(bossDamage(room, now), room.boss_max_hp);
  return normalStage(Math.floor(member.focused_seconds / 60), room.duration_minutes, completed);
}

function treeStats(room, now) {
  const stage = roomStage(room, now);
  const progress = !room.started_at ? 0
    : room.boss_id ? Math.min(100, Math.round((bossDamage(room, now) / room.boss_max_hp) * 100))
    : Math.min(100, Math.round((focusMsSince(room, now) / (room.duration_minutes * 60_000)) * 100));
  return { tree_stage: stage, tree_progress: progress, bloomed: stage >= 3 && statusOf(room, now) === 'finished' };
}

/** the next member to become host: whoever joined first among the people still in the room */
function passHost(room) {
  const next = activeMembers(room.id).sort((a, b) => a.joined_at - b.joined_at || a.id - b.id)[0];
  if (next) room.host_id = next.user_id;
}

// ---------- serializers (shape of API responses) ----------
const findUser = (id) => db.users.find((u) => u.id === id);

const publicUser = (u) => ({ id: u.id, display_name: u.display_name, avatar: u.avatar, level: levelOf(u.exp), allow_friend_requests: u.allow_friend_requests !== false });

const fullUser = (u) => {
  const level = levelOf(u.exp);
  return { id: u.id, username: u.username, display_name: u.display_name, avatar: u.avatar, exp: u.exp, level, unlocked_trees: unlockedTrees(level), allow_friend_requests: u.allow_friend_requests !== false, garden_theme: u.garden_theme ?? 'pond', role: u.role ?? 'student' };
};

function roomSummary(room, now) {
  return {
    id: room.id,
    title: room.title,
    topic: room.topic,
    location: room.location,
    tree_type: room.tree_type,
    duration_minutes: room.duration_minutes,
    max_members: room.max_members,
    status: statusOf(room, now),
    started_at: iso(room.started_at),
    ends_at: iso(room.ends_at),
    boss_id: room.boss_id,
    boss_name: room.boss_name ?? null,
    boss_max_hp: room.boss_max_hp ?? null,
    bonus_exp: room.boss_id ? null : room.bonus_exp ?? 0,
    break_every: room.break_every ?? 0,
    break_minutes: room.break_minutes ?? 0,
    theme: room.theme ?? null,
    chat_enabled: room.chat_enabled !== false,
    host: publicUser(findUser(room.host_id)),
    member_count: activeMembers(room.id).length,
  };
}

function roomDetail(room, now) {
  return {
    ...roomSummary(room, now),
    members: membersOf(room.id).map((m) => ({ user_id: m.user_id, ...publicUser(findUser(m.user_id)), status: m.status })),
    server_time: iso(now),
    boss_hp: room.boss_id ? bossHpOf(room, now) : null,
    ...treeStats(room, now),
  };
}

const bossOut = (b) => ({ ...b, defeated_at: iso(b.defeated_at) });

// ---------- guards ----------
function currentUser() {
  const userId = db.tokens[getToken()];
  const user = userId && findUser(userId);
  if (!user) fail(401, 'Please log in');
  return user;
}

function getRoomOr404(id) {
  const room = db.rooms.find((r) => r.id === Number(id));
  if (!room) fail(404, 'Room not found');
  return room;
}

function issueToken(user) {
  const token = `mock-${user.id}-${Math.random().toString(36).slice(2)}`;
  db.tokens[token] = user.id;
  return token;
}

// wraps each handler: fake latency, save after success, return a copy
const handler = (fn) => async (...args) => {
  await delay();
  const result = fn(...args);
  save();
  return clone(result);
};

// ---------- API (same names as realApi in client.js) ----------
export const mockApi = {
  register: handler(({ username = '', password = '', display_name = '' } = {}) => {
    const errors = {};
    if (!username.trim()) errors.username = ['Username is required'];
    else if (db.users.some((u) => u.username === username.trim())) errors.username = ['Username is already taken'];
    if (password.length < 6) errors.password = ['Password must be at least 6 characters'];
    if (!display_name.trim()) errors.display_name = ['Display name is required'];
    if (Object.keys(errors).length) fail(422, 'Validation failed', errors);

    const user = { id: nextId(db.users), username: username.trim(), password, display_name: display_name.trim(), avatar: { seed: username.trim() }, exp: 0 };
    db.users.push(user);
    return { token: issueToken(user), user: fullUser(user) };
  }),

  login: handler(({ username = '', password = '' } = {}) => {
    const user = db.users.find((u) => u.username === username.trim());
    if (!user || user.password !== password) fail(401, 'Wrong username or password');
    return { token: issueToken(user), user: fullUser(user) };
  }),

  me: handler(() => fullUser(currentUser())),

  updateAvatar: handler((avatar) => {
    const user = currentUser();
    if (!avatar || typeof avatar !== 'object') fail(422, 'Validation failed', { avatar: ['Avatar must be an object'] });
    user.avatar = avatar;
    return fullUser(user);
  }),

  garden: handler(() => gardenOf(currentUser().id)),

  listRooms: handler(({ status, topic } = {}) => {
    currentUser();
    const now = Date.now();
    return db.rooms
      .map((r) => roomSummary(r, now))
      .filter((r) => !status || r.status === status)
      .filter((r) => !topic || r.topic.toLowerCase().includes(topic.toLowerCase()))
      .sort((a, b) => b.id - a.id);
  }),

  createRoom: handler((payload = {}) => {
    const user = currentUser();
    const { title = '', topic = '', location = null, tree_type, duration_minutes, max_members, boss_id = null, theme = null, chat_enabled = true, break_every = 0, break_minutes = 0 } = payload;
    const level = levelOf(user.exp);
    const errors = {};
    if (!title.trim()) errors.title = ['Title is required'];
    if (!topic.trim()) errors.topic = ['Topic is required'];
    if (!(tree_type in TREE_UNLOCKS)) errors.tree_type = ['Unknown tree type'];
    else if (level < TREE_UNLOCKS[tree_type]) errors.tree_type = [`Unlocks at Lv.${TREE_UNLOCKS[tree_type]}`];
    const maxMin = boss_id ? MAX_BOSS_DURATION : MAX_DURATION;
    if (!(duration_minutes >= MIN_DURATION && duration_minutes <= maxMin)) errors.duration_minutes = [`Must be ${MIN_DURATION}–${maxMin} minutes`];
    const breaks = Number(break_every) > 0 && Number(break_minutes) > 0;
    if (breaks && Number(duration_minutes) < MIN_BREAK_ROOM) errors.break_every = [`Breaks need a room of ${MIN_BREAK_ROOM}+ minutes`];
    else if (breaks && !(Number(break_every) >= 15 && Number(break_every) < Number(duration_minutes))) errors.break_every = ['Must be shorter than the room'];
    if (breaks && !(Number(break_minutes) <= MAX_BREAK)) errors.break_minutes = [`Breaks are at most ${MAX_BREAK} minutes`];
    if (boss_id && level < BOSS_MIN_LEVEL) errors.boss_id = [`Boss rooms unlock at Lv.${BOSS_MIN_LEVEL}`];
    if (!(max_members >= 2 && max_members <= 10)) errors.max_members = ['Must be 2–10 people'];
    if (boss_id && !db.bosses.some((b) => b.id === Number(boss_id))) errors.boss_id = ['Boss not found'];
    if (Object.keys(errors).length) fail(422, 'Validation failed', errors);

    const now = Date.now();
    const room = {
      id: nextId(db.rooms), host_id: user.id, title: title.trim(), topic: topic.trim(), location: location?.trim() || null,
      tree_type, duration_minutes: Number(duration_minutes), max_members: Number(max_members), status: 'waiting',
      started_at: null, ends_at: null, boss_id: boss_id ? Number(boss_id) : null, members_at_start: 0, created_at: now,
      theme: theme || null, chat_enabled: Boolean(chat_enabled),
      break_every: breaks ? Number(break_every) : 0, break_minutes: breaks ? Number(break_minutes) : 0,
      ...bossFields(boss_id ? db.bosses.find((b) => b.id === Number(boss_id)) : null),
      bonus_exp: boss_id ? 0 : rollHarvestBonus(Number(duration_minutes)), // rolled once, at creation
    };
    db.rooms.push(room);
    db.room_members.push({ id: nextId(db.room_members), room_id: room.id, user_id: user.id, status: 'joined', focused_seconds: 0, joined_at: now, left_at: null, claimed_at: null });
    return roomDetail(room, now);
  }),

  getRoom: handler((id) => {
    currentUser();
    return roomDetail(getRoomOr404(id), Date.now());
  }),

  joinRoom: handler((id) => {
    const user = currentUser();
    const room = getRoomOr404(id);
    const now = Date.now();
    if (statusOf(room, now) !== 'waiting') fail(422, 'This room has already started');
    if (membersOf(room.id).some((m) => m.user_id === user.id)) fail(422, 'You are already in this room');
    if (activeMembers(room.id).length >= room.max_members) fail(422, 'Room is full');
    if (room.boss_id && levelOf(user.exp) < BOSS_MIN_LEVEL) fail(403, `Boss rooms unlock at Lv.${BOSS_MIN_LEVEL}`);
    db.room_members.push({ id: nextId(db.room_members), room_id: room.id, user_id: user.id, status: 'joined', focused_seconds: 0, joined_at: now, left_at: null, claimed_at: null });
    return roomDetail(room, now);
  }),

  startRoom: handler((id) => {
    const user = currentUser();
    const room = getRoomOr404(id);
    const now = Date.now();
    if (room.host_id !== user.id) fail(403, 'Only the host can start the room');
    if (statusOf(room, now) !== 'waiting') fail(422, 'Room has already started');
    room.status = 'running';
    room.started_at = now;
    room.ends_at = now + sessionMinutes(room.duration_minutes, room.break_every, room.break_minutes) * MINUTE_MS; // breaks included
    room.members_at_start = activeMembers(room.id).length;
    return roomDetail(room, now);
  }),

  leaveRoom: handler((id) => {
    const user = currentUser();
    const room = getRoomOr404(id);
    const now = Date.now();
    const member = membersOf(room.id).find((m) => m.user_id === user.id);
    if (!member) fail(422, 'You are not in this room');
    const status = statusOf(room, now);

    if (status === 'waiting') {
      db.room_members = db.room_members.filter((m) => m !== member);
      if (activeMembers(room.id).length === 0) db.rooms = db.rooms.filter((r) => r !== room);
      else if (room.host_id === user.id) passHost(room);
      return { room: null, exp_gained: 0, user: fullUser(user) };
    }
    if (status === 'finished') fail(422, 'Session is over — claim your fruit instead');
    if (member.status !== 'joined') fail(422, 'You already left this room');

    member.focused_seconds = focusSecondsOf(room, member, now);
    member.tree_stage = memberStage(room, member, now, false); // takes home the tree as it is right now
    member.status = 'left';
    member.left_at = now;
    const minutes = Math.floor(member.focused_seconds / 60);
    // left before half of the session -> -2 EXP (never below 0). Otherwise half the minutes, rounded up.
    const early = member.focused_seconds < (room.duration_minutes * 60) / 2;
    const exp_gained = early ? -Math.min(EARLY_LEAVE_PENALTY, user.exp) : focusExp(minutes);
    user.exp += exp_gained;
    if (room.host_id === user.id) passHost(room);
    return { room: roomDetail(room, now), exp_gained, user: fullUser(user) };
  }),

  claimRoom: handler((id) => {
    const user = currentUser();
    const room = getRoomOr404(id);
    const now = Date.now();
    const member = membersOf(room.id).find((m) => m.user_id === user.id);
    if (!member) fail(422, 'You are not in this room');
    if (statusOf(room, now) !== 'finished') fail(422, 'Session is not over yet');
    if (member.status === 'completed') fail(422, 'Already claimed');
    if (member.status !== 'joined') fail(422, 'You left this session early');
    if (now > room.ends_at + CLAIM_WINDOW_MS) fail(422, 'Claim window has closed');

    member.focused_seconds = room.duration_minutes * 60;
    member.status = 'completed';
    member.claimed_at = now;
    member.tree_stage = memberStage(room, member, room.ends_at, true);
    // half the minutes (rounded up) + bonus: boss rooms only when the pest is dead, normal rooms the rolled bonus
    const bonus = room.boss_id
      ? (bossHpOf(room, room.ends_at) === 0 ? bossBonus(room.duration_minutes) : 0)
      : room.bonus_exp ?? 0;
    const exp_gained = focusExp(room.duration_minutes) + bonus;
    user.exp += exp_gained;
    return { room: roomDetail(room, now), exp_gained, user: fullUser(user) };
  }),

  listBosses: handler(() => {
    currentUser();
    return db.bosses.map(bossOut);
  }),

  createBoss: handler(({ name = '', topic = '', max_hp } = {}) => {
    const user = currentUser();
    const errors = {};
    if (!name.trim()) errors.name = ['Name is required'];
    if (!topic.trim()) errors.topic = ['Topic is required'];
    if (!(max_hp >= 50 && max_hp <= 5000)) errors.max_hp = ['HP must be 50–5000'];
    if (Object.keys(errors).length) fail(422, 'Validation failed', errors);
    const boss = { id: nextId(db.bosses), name: name.trim(), topic: topic.trim(), max_hp: Number(max_hp), current_hp: Number(max_hp), created_by: user.id, defeated_at: null };
    db.bosses.push(boss);
    return bossOut(boss);
  }),

  getBoss: handler((id) => {
    currentUser();
    const boss = db.bosses.find((b) => b.id === Number(id));
    if (!boss) fail(404, 'Boss not found');
    return bossOut(boss);
  }),
};

// ---------- garden ----------
function gardenEntry(m, now) {
  const room = db.rooms.find((r) => r.id === m.room_id);
  return {
    room_id: room.id, title: room.title, tree_type: room.tree_type, boss_id: room.boss_id,
    tree_stage: m.tree_stage ?? 1, bloomed: (m.tree_stage ?? 1) >= 3, finished_at: iso(room.ends_at),
    name: m.tree_name ?? null,
    last_watered_at: iso(m.last_watered_at ?? room.ends_at),
    revive_count: m.revive_count ?? 0, revive_started_at: iso(m.revive_started_at), revive_last_day: m.revive_last_day ?? null,
  };
}

function gardenMembers(userId, now) {
  return db.room_members.filter((m) => {
    if (m.user_id !== userId || m.status === 'joined') return false;
    const room = db.rooms.find((r) => r.id === m.room_id);
    return room && statusOf(room, now) === 'finished';
  });
}

function gardenOf(userId) {
  const now = Date.now();
  return gardenMembers(userId, now)
    .map((m) => gardenEntry(m, now))
    .sort((a, b) => a.finished_at.localeCompare(b.finished_at));
}

const isFriend = (a, b) => db.friend_requests.some(
  (r) => r.status === 'accepted' && ((r.from_id === a && r.to_id === b) || (r.from_id === b && r.to_id === a)),
);

// ---------- friends + chat ----------
function friendsOf(userId) {
  const reqs = db.friend_requests;
  const other = (r) => (r.from_id === userId ? r.to_id : r.from_id);
  const withUser = (r, id) => ({ id: r.id, user: { ...publicUser(findUser(id)), username: findUser(id).username } });
  return {
    friends: reqs.filter((r) => r.status === 'accepted' && (r.from_id === userId || r.to_id === userId))
      .map((r) => ({ ...publicUser(findUser(other(r))), username: findUser(other(r)).username })),
    incoming: reqs.filter((r) => r.status === 'pending' && r.to_id === userId).map((r) => withUser(r, r.from_id)),
    outgoing: reqs.filter((r) => r.status === 'pending' && r.from_id === userId).map((r) => withUser(r, r.to_id)),
  };
}

const messageOut = (msg) => {
  const u = findUser(msg.user_id);
  return { id: msg.id, user_id: msg.user_id, display_name: u?.display_name ?? '?', body: msg.body, created_at: iso(msg.created_at) };
};

Object.assign(mockApi, {
  friends: handler(() => friendsOf(currentUser().id)),

  sendFriendRequest: handler((userId) => {
    const me = currentUser();
    const target = findUser(Number(userId));
    if (!target) fail(404, 'Player not found');
    if (target.id === me.id) fail(422, "You can't add yourself");
    if (target.allow_friend_requests === false) fail(403, 'This player is not accepting friend requests');
    const existing = db.friend_requests.find(
      (r) => (r.from_id === me.id && r.to_id === target.id) || (r.from_id === target.id && r.to_id === me.id),
    );
    if (existing?.status === 'accepted') fail(422, 'Already friends');
    if (existing?.from_id === me.id) fail(422, 'Request already sent');
    if (existing) existing.status = 'accepted'; // they already asked me → become friends
    else db.friend_requests.push({ id: nextId(db.friend_requests), from_id: me.id, to_id: target.id, status: 'pending' });
    return friendsOf(me.id);
  }),

  respondFriendRequest: handler((requestId, accept) => {
    const me = currentUser();
    const req = db.friend_requests.find((r) => r.id === Number(requestId) && r.status === 'pending');
    if (!req || (req.to_id !== me.id && req.from_id !== me.id)) fail(404, 'Request not found');
    if (accept && req.to_id !== me.id) fail(403, 'Only the receiver can accept');
    if (accept) req.status = 'accepted';
    else db.friend_requests = db.friend_requests.filter((r) => r !== req); // decline or cancel
    return friendsOf(me.id);
  }),

  removeFriend: handler((userId) => {
    const me = currentUser();
    db.friend_requests = db.friend_requests.filter(
      (r) => !(r.status === 'accepted' && ((r.from_id === me.id && r.to_id === Number(userId)) || (r.to_id === me.id && r.from_id === Number(userId)))),
    );
    return friendsOf(me.id);
  }),

  updateSettings: handler((settings = {}) => {
    const me = currentUser();
    if ('allow_friend_requests' in settings) me.allow_friend_requests = Boolean(settings.allow_friend_requests);
    if ('garden_theme' in settings) {
      const theme = GARDEN_THEMES.find((g) => g.key === settings.garden_theme);
      if (!theme) fail(422, 'Validation failed', { garden_theme: ['Unknown theme'] });
      if (levelOf(me.exp) < theme.level) fail(422, 'Validation failed', { garden_theme: [`Unlocks at Lv.${theme.level}`] });
      me.garden_theme = theme.key;
    }
    return fullUser(me);
  }),

  listMessages: handler((roomId, afterId = 0) => {
    currentUser();
    const room = getRoomOr404(roomId);
    return db.messages.filter((x) => x.room_id === room.id && x.id > Number(afterId)).slice(-100).map(messageOut);
  }),

  sendMessage: handler((roomId, body = '') => {
    const me = currentUser();
    const room = getRoomOr404(roomId);
    if (room.chat_enabled === false) fail(403, 'Chat is off in this room');
    if (!membersOf(room.id).some((x) => x.user_id === me.id)) fail(403, 'Join the room to chat');
    const text = String(body).trim();
    if (!text) fail(422, 'Validation failed', { body: ['Message is empty'] });
    if (text.length > 200) fail(422, 'Validation failed', { body: ['Max 200 characters'] });
    const msg = { id: nextId(db.messages), room_id: room.id, user_id: me.id, body: text, created_at: Date.now() };
    db.messages.push(msg);
    return messageOut(msg);
  }),
});

Object.assign(mockApi, {
  userGarden: handler((userId) => {
    const me = currentUser();
    const owner = findUser(Number(userId));
    if (!owner) fail(404, 'Player not found');
    if (owner.id !== me.id && !isFriend(me.id, owner.id)) fail(403, 'Only friends can visit this garden');
    return { user: { ...publicUser(owner), username: owner.username, garden_theme: owner.garden_theme ?? 'pond' }, trees: gardenOf(owner.id) };
  }),

  waterGarden: handler(() => {
    const me = currentUser();
    const now = Date.now();
    for (const m of gardenMembers(me.id, now)) {
      const next = waterTree(gardenEntry(m, now), now);
      m.last_watered_at = new Date(next.last_watered_at).getTime();
      m.revive_count = next.revive_count;
      m.revive_started_at = next.revive_started_at ? new Date(next.revive_started_at).getTime() : null;
      m.revive_last_day = next.revive_last_day;
    }
    return gardenOf(me.id);
  }),

  renameTree: handler((roomId, name) => {
    const me = currentUser();
    const m = gardenMembers(me.id, Date.now()).find((x) => x.room_id === Number(roomId));
    if (!m) fail(404, 'Tree not found');
    const clean = String(name ?? '').trim();
    if (clean.length > 30) fail(422, 'Validation failed', { name: ['Max 30 characters'] });
    m.tree_name = clean || null;
    return gardenEntry(m, Date.now());
  }),
});

Object.assign(mockApi, {
  // admin only: jump to any level to preview unlocks
  adminSetLevel: handler((level) => {
    const me = currentUser();
    if (me.role !== 'admin') fail(403, 'Admins only');
    const lv = Math.max(1, Math.min(MAX_LEVEL, Math.round(Number(level))));
    if (!lv) fail(422, 'Validation failed', { level: ['Level must be 1–60'] });
    me.exp = (lv - 1) * 100;
    return fullUser(me);
  }),
});

// ---------- dev helpers ----------
export const mockDebug = {
  /** Wipe everything back to the seed data. */
  reset() {
    db = seed();
    save();
  },
  /** Pretend N days passed since every tree in your garden was watered (to test dying). */
  ageGarden(days) {
    const userId = db.tokens[getToken()];
    db.room_members.filter((m) => m.user_id === userId).forEach((m) => {
      if (m.last_watered_at) m.last_watered_at -= days * 86_400_000;
      if (m.revive_started_at) m.revive_started_at -= days * 86_400_000;
      m.revive_last_day = null;
    });
    save();
  },
  /** End a running room right now (to test the claim screen). */
  endRoomNow(id) {
    const room = getRoomOr404(id);
    if (room.status !== 'running') fail(422, 'Room is not running');
    const now = Date.now();
    room.started_at = now - sessionMinutes(room.duration_minutes, room.break_every, room.break_minutes) * MINUTE_MS;
    room.ends_at = now;
    save();
  },
};
