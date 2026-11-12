// Adapts the real Yii2 API responses to the shape the React pages expect,
// so differences in the backend only need fixing here.
//
// Differences handled:
// - timestamps come as unix seconds  -> ISO strings
// - rooms/bosses use subject_code   -> topic
// - lists are wrapped ({rooms: [...]}, {bosses: [...]}, {boss: {...}})
// - avatar may be a JSON string or an old placeholder -> avatar object
// - validation errors may be strings / objects -> arrays of strings

export function toIso(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    return new Date(Number(value) * 1000).toISOString();
  }
  return value;
}

export function normalizeAvatarData(avatar, fallbackSeed) {
  let a = avatar;
  for (let i = 0; i < 2 && typeof a === 'string'; i++) {
    try {
      a = JSON.parse(a);
    } catch {
      a = null;
    }
  }
  if (!a || typeof a !== 'object' || a.hair == null) {
    // no character chosen yet: give each user their own random-looking default
    return { seed: String(fallbackSeed ?? 'player') };
  }
  return a;
}

export function normalizeUser(user) {
  if (!user) return user;
  return { ...user, avatar: normalizeAvatarData(user.avatar, user.username ?? user.id) };
}

export function normalizeRoom(room) {
  if (!room) return room;
  return {
    ...room,
    topic: room.topic ?? room.subject_code ?? '',
    started_at: toIso(room.started_at),
    ends_at: toIso(room.ends_at),
    created_at: toIso(room.created_at),
    server_time: room.server_time ? toIso(room.server_time) : undefined,
    tree_progress: Math.min(100, Math.round(Number(room.tree_progress ?? 0))),
    host: room.host ? { ...room.host, avatar: normalizeAvatarData(room.host.avatar, room.host.username ?? room.host.id) } : room.host,
    members: room.members?.map((m) => ({ ...m, avatar: normalizeAvatarData(m.avatar, m.user_id) })),
    chat_enabled: room.chat_enabled == null ? true : Boolean(Number(room.chat_enabled)),
    theme: room.theme || null,
  };
}

export function normalizeBoss(boss) {
  if (!boss) return boss;
  return { ...boss, topic: boss.topic ?? boss.subject_code ?? '', defeated_at: toIso(boss.defeated_at) };
}

// "Room not found" / {title: "..."} / {tree_type: {required_level: 3}} -> {field: ["message"]}
export function normalizeErrors(errors) {
  if (!errors || typeof errors !== 'object') return {};
  const out = {};
  for (const [field, value] of Object.entries(errors)) {
    if (Array.isArray(value)) out[field] = value.map(String);
    else if (value && typeof value === 'object' && 'required_level' in value) out[field] = [`Unlocks at Lv.${value.required_level}`];
    else out[field] = [String(value)];
  }
  return out;
}

// payloads going out: React uses `topic`, the backend stores `subject_code`
export function roomPayload(payload) {
  const { topic, location, ...rest } = payload;
  return { ...rest, subject_code: topic, location: location?.trim() || 'Online', chat_enabled: rest.chat_enabled ? 1 : 0 };
}

export function bossPayload(payload) {
  const { topic, ...rest } = payload;
  return { ...rest, subject_code: topic };
}

export function normalizeFriends(res) {
  const fix = (u) => (u ? { ...u, avatar: normalizeAvatarData(u.avatar, u.username ?? u.id) } : u);
  return {
    friends: (res?.friends ?? []).map(fix),
    incoming: (res?.incoming ?? []).map((r) => ({ ...r, user: fix(r.user) })),
    outgoing: (res?.outgoing ?? []).map((r) => ({ ...r, user: fix(r.user) })),
  };
}

export function normalizeGarden(list) {
  return (Array.isArray(list) ? list : list?.trees ?? [])
    .map((g) => ({
      ...g,
      finished_at: toIso(g.finished_at),
      last_watered_at: toIso(g.last_watered_at),
      revive_started_at: toIso(g.revive_started_at),
    }))
    .filter((g) => g.finished_at && new Date(g.finished_at).getTime() <= Date.now());
}
