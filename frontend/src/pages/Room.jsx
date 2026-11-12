import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth.jsx';
import { TREES } from '../constants.js';
import { useT } from '../i18n.jsx';
import Avatar from '../components/Avatar.jsx';
import Pet from '../components/Pet.jsx';
import BossOrbit from '../components/BossOrbit.jsx';
import RoomChat from '../components/RoomChat.jsx';
import { BOSS_ART, roomBackground, treeArt, treeStageFor } from '../scene/art.js';
import { bossBonus, bossStage, breakLeftMs, focusExp, focusMsAt, normalStage } from '../rules.js';
import { roomTheme, usePageBackground } from '../scene/pageBackground.jsx';
import './room.css';

const POLL_MS = 5000;
const CHAT_POLL_MS = 3000;
const BUBBLE_MS = 6000;
const CLAIM_WINDOW_MS = 10 * 60_000;
const EARLY_LEAVE_PENALTY = 2; // must match the backend

// "mm:ss" or "h:mm:ss"
function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** friend status of another player, from the GET /friends lists */
function relationTo(userId, friends) {
  if (!friends) return { kind: 'loading' };
  if (friends.friends.some((f) => f.id === userId)) return { kind: 'friend' };
  if (friends.outgoing.some((r) => r.user.id === userId)) return { kind: 'requested' };
  const inc = friends.incoming.find((r) => r.user.id === userId);
  if (inc) return { kind: 'incoming', requestId: inc.id };
  return { kind: 'none' };
}

export default function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { t } = useT();

  const [room, setRoom] = useState(null);
  const [offset, setOffset] = useState(0); // serverTime - localTime
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { type: 'left' | 'claim', exp, bloomed }
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [lobbyGuard, setLobbyGuard] = useState(false); // confirm opened from the LOBBY button
  const [boss, setBoss] = useState(null);
  const [friends, setFriends] = useState(null);
  const [openCard, setOpenCard] = useState(null); // user_id whose card is pinned open (tap on phones)
  const [messages, setMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const lastMsgId = useRef(0);

  usePageBackground(roomTheme(room));

  const applyRoom = useCallback((r) => {
    setOffset(new Date(r.server_time).getTime() - Date.now());
    setRoom(r);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.getRoom(id);
      applyRoom(r);
      // each boss room has its own pest (boss_name / boss_max_hp / boss_hp); older API: fetch the shared boss
      if (r.boss_id && r.boss_max_hp != null) setBoss({ name: r.boss_name ?? 'Pest', max_hp: Number(r.boss_max_hp) });
      else if (r.boss_id) api.getBoss(r.boss_id).then(setBoss).catch(() => {});
    } catch (err) {
      setError(err.message);
    }
  }, [id, applyRoom]);

  // poll the room so we see people join / start / leave
  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    api.friends().then(setFriends).catch(() => setFriends({ friends: [], incoming: [], outgoing: [] }));
  }, []);

  // chat: poll for new messages (also drives the speech bubbles over the characters)
  const chatOn = room ? room.chat_enabled !== false : false;
  const pollChat = useCallback(async () => {
    try {
      const fresh = await api.listMessages(id, lastMsgId.current);
      if (fresh.length) {
        lastMsgId.current = fresh[fresh.length - 1].id;
        setMessages((prev) => [...prev, ...fresh.filter((f) => !prev.some((p) => p.id === f.id))].slice(-100));
      }
    } catch {
      /* chat is optional — ignore */
    }
  }, [id]);
  useEffect(() => {
    if (!chatOn) return undefined;
    pollChat();
    const timer = setInterval(pollChat, CHAT_POLL_MS);
    return () => clearInterval(timer);
  }, [chatOn, pollChat]);
  useEffect(() => {
    if (chatOpen) setSeenCount(messages.length);
  }, [chatOpen, messages.length]);

  // local clock for the countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(timer);
  }, []);

  const serverNow = now + offset;
  const endsAt = room?.ends_at ? new Date(room.ends_at).getTime() : null;

  // flip to finished exactly at 00:00 instead of waiting for the next poll
  const status = room && room.status === 'running' && endsAt && serverNow >= endsAt ? 'finished' : room?.status;
  useEffect(() => {
    if (status === 'finished') load();
  }, [status, load]);

  const me = room?.members.find((m) => m.user_id === user.id);
  const isHost = room?.host.id === user.id;

  // Live boss HP: the server reports HP as of its last answer; between polls we keep counting
  // 1 damage per focused minute per player so the bar moves smoothly.
  const startedMs = room?.started_at ? new Date(room.started_at).getTime() : null;
  const focusingNow = room?.members.filter((m) => m.status === 'joined').length ?? 0;
  // optional breaks: break time is not focus time (rules.js)
  const breakEvery = Number(room?.break_every ?? 0);
  const breakLen = Number(room?.break_minutes ?? 0);
  const focusMs = (t) => (startedMs ? focusMsAt(Math.min(t, endsAt) - startedMs, breakEvery, breakLen) : 0);
  const minutesAt = (t) => Math.floor(focusMs(t) / 60_000);
  const breakLeft = status === 'running' && startedMs ? breakLeftMs(serverNow - startedMs, room.duration_minutes, breakEvery, breakLen) : 0;
  const onBreak = breakLeft > 0;
  const clock = !room ? '--:--'
    : status === 'waiting' ? formatClock(room.duration_minutes * 60_000)
    : status === 'running' ? (onBreak ? formatClock(breakLeft) : formatClock(room.duration_minutes * 60_000 - focusMs(serverNow)))
    : '00:00';
  const elapsedMin = minutesAt(serverNow);
  const serverTimeMs = room?.server_time ? new Date(room.server_time).getTime() : serverNow;
  const ownBoss = room?.boss_hp != null; // new API: HP of this room's own pest
  const pendingDamage = status === 'running' || status === 'finished'
    ? focusingNow * (ownBoss ? elapsedMin - minutesAt(serverTimeMs) : elapsedMin)
    : 0;
  const bossHp = !boss ? null : Math.max(0, (ownBoss ? Number(room.boss_hp) : boss.current_hp) - Math.max(0, pendingDamage));
  const bossAlive = bossHp !== null && bossHp > 0;

  // flash the "got hit" frame + floating damage number whenever HP drops
  const prevHp = useRef(null);
  const [hit, setHit] = useState(null); // { amount, key }
  useEffect(() => {
    if (bossHp === null) return;
    if (prevHp.current !== null && bossHp < prevHp.current) {
      const h = { amount: prevHp.current - bossHp, key: Date.now() };
      setHit(h);
      setTimeout(() => setHit((cur) => (cur?.key === h.key ? null : cur)), 900);
    }
    prevHp.current = bossHp;
  }, [bossHp]);

  const bossArt = !boss ? null
    : bossHp === 0 ? BOSS_ART.dead
    : hit ? BOSS_ART.hit
    : bossHp / boss.max_hp < 0.3 ? BOSS_ART.weak
    : BOSS_ART.idle;

  async function act(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
      load();
    } finally {
      setBusy(false);
    }
  }

  const join = () => act(async () => applyRoom(await api.joinRoom(id)));
  const start = () => act(async () => applyRoom(await api.startRoom(id)));
  const leave = () =>
    act(async () => {
      const res = await api.leaveRoom(id);
      setUser((prev) => ({ ...prev, ...res.user })); // merge: backend may send a smaller user object
      setConfirmLeave(false);
      if (!res.room) return navigate('/'); // left before it started
      applyRoom(res.room);
      setResult({ type: 'left', exp: res.exp_gained });
    });
  const claim = () =>
    act(async () => {
      const res = await api.claimRoom(id);
      setUser((prev) => ({ ...prev, ...res.user }));
      applyRoom(res.room);
      setResult({ type: 'claim', exp: res.exp_gained, bloomed: (res.room.tree_stage ?? 0) >= 3 || res.room.bloomed });
    });

  async function friendAction(member, rel) {
    try {
      if (rel.kind === 'none') setFriends(await api.sendFriendRequest(member.user_id));
      if (rel.kind === 'incoming') setFriends(await api.respondFriendRequest(rel.requestId, true));
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendChat(body) {
    const msg = await api.sendMessage(id, body);
    lastMsgId.current = Math.max(lastMsgId.current, msg.id);
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }

  if (!room) {
    return (
      <div className="container">
        {error
          ? <div className="error-box">{error} <Link to="/">{t('room.back')}</Link></div>
          : <p className="pixel loading">{t('room.loading')}</p>}
      </div>
    );
  }

  const treeKey = TREES[room.tree_type] ? room.tree_type : 'cactus';
  const treeName = t(`tree.${treeKey}`);
  const minutesSoFar = status === 'running' && me?.status === 'joined' ? elapsedMin : 0;
  // leaving before half of the FOCUS time costs EXP_PENALTY (breaks don't count)
  const halfFocusMs = (room.duration_minutes * 60_000) / 2;
  const beforeHalfway = status === 'running' && focusMs(serverNow) < halfFocusMs;
  const leaveExp = beforeHalfway ? -EARLY_LEAVE_PENALTY : focusExp(minutesSoFar);
  const expText = (n) => (n >= 0 ? `+${n}` : `${n}`);
  const focusingNowMe = status === 'running' && me?.status === 'joined';
  function guardLobby() {
    setConfirmLeave(true);
    setLobbyGuard(true);
    requestAnimationFrame(() => document.querySelector('.confirm')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  // ---------- tree + boss ----------
  // Stages (rules.js): normal rooms grow at half time and fully bloom only when the session is completed;
  // boss rooms grow every HP/3 and get the "-win" tree only when the pest is dead.
  const isBossRoom = Boolean(room.boss_id);
  const newRules = room.tree_stage != null;
  let liveStage;
  if (!newRules) liveStage = status === 'finished' && room.bloomed ? 3 : treeStageFor(status, room.tree_progress);
  else if (status === 'waiting') liveStage = 1;
  else if (isBossRoom && boss) liveStage = bossStage(boss.max_hp - bossHp, boss.max_hp);
  else if (status === 'running') liveStage = normalStage(elapsedMin, room.duration_minutes, false);
  else liveStage = room.tree_stage;
  const bossWin = isBossRoom && (bossHp === 0 || liveStage === 4 || (!newRules && status === 'finished' && room.bloomed));
  const stage = Math.min(3, liveStage);
  const won = status === 'finished' && stage >= 3;
  // the pest only gets a bite in when someone in the room gave up early
  const someoneLeft = room.members.some((m) => m.status === 'left');
  const bitten = isBossRoom && bossAlive && someoneLeft && stage < 3;
  const treeSrc = treeArt(room.tree_type, stage, { bitten, win: bossWin });
  const treeProgress = !newRules ? room.tree_progress
    : status === 'waiting' ? 0
    : isBossRoom && boss ? Math.round(((boss.max_hp - bossHp) / boss.max_hp) * 100)
    : Math.min(100, Math.round((elapsedMin / room.duration_minutes) * 100));
  // harvest = half the minutes (rounded up) + bonus (boss rooms: only if the pest is dead)
  const harvestExp = focusExp(room.duration_minutes)
    + (isBossRoom ? (bossHp === 0 ? bossBonus(room.duration_minutes) : 0) : Number(room.bonus_exp ?? 0));
  const claimLeft = endsAt ? endsAt + CLAIM_WINDOW_MS - serverNow : 0;

  // players stand on the lower arc around the tree (left → bottom → right)
  const seats = room.members.map((m, i) => {
    const n = room.members.length;
    const from = Math.PI - 0.25;
    const to = 0.25;
    const angle = n === 1 ? Math.PI / 2 : from + ((to - from) * i) / (n - 1);
    return { ...m, x: 50 + Math.cos(angle) * 28, y: 58 + Math.sin(angle) * 18 };
  });

  // speech bubbles: each player's latest message for a few seconds
  const bubbles = {};
  for (const msg of messages) {
    if (now - new Date(msg.created_at).getTime() < BUBBLE_MS) bubbles[msg.user_id] = msg.body;
  }
  const unread = chatOpen ? 0 : Math.max(0, messages.length - seenCount);

  return (
    <div className="container room-page">
      <div className="room-top">
        {focusingNowMe ? (
          // leaving mid-session must go through the same rules as "I need to go"
          <button type="button" className="btn ghost small" onClick={guardLobby}>{t('common.back_lobby')}</button>
        ) : (
          <Link to="/" className="btn ghost small">{t('common.back_lobby')}</Link>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 className="room-heading">{room.title}</h1>
          <p className="room-sub">
            {room.topic} · {room.location || t('common.online')} · {room.duration_minutes} {t('common.min')}
            {breakEvery > 0 && breakLen > 0 && ` · ${t('room.break_rule', { every: breakEvery, len: breakLen })}`}
            {' · '}{t('room.host', { name: room.host.display_name })}
          </p>
        </div>
      </div>

      {/* ---------- the clearing ---------- */}
      <section className={`scene ${status}`} style={roomBackground(room)} aria-label={room.title}>
        <div className={`room-tree ${won ? 'won' : ''}`} title={`${treeName} – ${treeProgress}%`}>
          <img src={treeSrc} alt={`${treeName} ${stage}/3`} className="pixelated" />
        </div>

        {boss && (
          <BossOrbit src={bossArt} alt={boss.name} dead={bossHp === 0} hit={hit} hpPercent={(bossHp / boss.max_hp) * 100} />
        )}

        {status === 'running' && <div className="tree-glow" />}

        {seats.map((m) => {
          const isMe = m.user_id === user.id;
          const rel = isMe ? null : relationTo(m.user_id, friends);
          const open = openCard === m.user_id;
          return (
            <div
              key={m.user_id}
              className={`seat-spot ${m.status} ${isMe ? 'me' : ''} ${open ? 'open' : ''}`}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
            >
              {bubbles[m.user_id] ? (
                <span className="speech">{bubbles[m.user_id]}</span>
              ) : (
                <>
                                                    </>
              )}

              <button
                type="button"
                className="seat-hit"
                onClick={() => setOpenCard(open ? null : m.user_id)}
                aria-expanded={open}
                aria-label={`${m.display_name}, ${t('player.level', { lv: m.level })}`}
              >
                <Avatar avatar={m.avatar} size={96} framed={false} />
              </button>
              {m.avatar?.pet?.type && <Pet pet={m.avatar.pet} size={48} className="seat-pet" title={m.avatar.pet.name || ''} />}
              <span className="nametag">{isMe ? t('common.you') : m.display_name}</span>

              {/* level card: shows on hover (mouse) or tap (phone) */}
              <div className="player-card panel" role="tooltip">
                <div className="pc-name">{m.display_name}</div>
                <div className="pc-level pixel">{t('player.level', { lv: m.level })}</div>
                {m.avatar?.pet?.name && <div className="pc-pet">{m.avatar.pet.name}</div>}
                {rel?.kind === 'friend' && <span className="pc-tag pixel">{t('player.friend')}</span>}
                {rel?.kind === 'requested' && <span className="pc-tag muted pixel">{t('player.requested')}</span>}
                {rel?.kind === 'incoming' && (
                  <button type="button" className="btn small" onClick={() => friendAction(m, rel)}>{t('player.accept')}</button>
                )}
                {rel?.kind === 'none' && m.allow_friend_requests !== false && (
                  <button type="button" className="btn small" onClick={() => friendAction(m, rel)}>{t('player.add')}</button>
                )}
              </div>
            </div>
          );
        })}

        {/* HUD */}
        <div className={`hud hud-clock pixel ${onBreak ? 'on-break' : ''}`} aria-live="polite">{onBreak && <span className="break-tag">{t('room.break')}</span>}{clock}</div>
        <div className="hud hud-tree">
          <img src={treeArt(treeKey, 3)} alt="" className="hud-tree-ico pixelated" />
          <div className="bar tree-bar"><span style={{ width: `${treeProgress}%` }} /></div>
          <span className="pixel">{treeProgress}%</span>
        </div>
        {chatOn ? (
          <button
            type="button"
            className={`hud-chat btn small badge-wrap ${chatOpen ? 'gold' : 'ghost'}`}
            onClick={() => setChatOpen((o) => !o)}
            aria-expanded={chatOpen}
          >
            {t('chat.open')}
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
        ) : (
          <span className="hud hud-chat hud-silent pixel" title={t('chat.disabled')}>{t('card.focus_mode')}</span>
        )}
      </section>

      {chatOn && chatOpen && (
        <RoomChat messages={messages} meId={user.id} canSend={Boolean(me)} onSend={sendChat} onClose={() => setChatOpen(false)} />
      )}

      {/* ---------- action panel ---------- */}
      <section className="panel room-actions">
        {error && <div className="error-box">{error}</div>}

        {result && (
          <div className="result">
            <h2>{result.type === 'claim' ? t('room.harvested') : t('room.see_you')}</h2>
            <p className={`pixel exp-gain ${result.exp < 0 ? 'negative' : ''}`}>{expText(result.exp)} EXP</p>
            {result.type === 'left' && result.exp < 0 && <p className="muted">{t('room.penalty_note')}</p>}
            {result.type === 'claim' && <p className="muted">{result.bloomed ? t('room.bloom_note') : t('room.no_bloom_note')}</p>}
          </div>
        )}

        {status === 'waiting' && (
          <>
            <h2>{t('room.waiting')}</h2>
            <p className="muted">
              {t('room.joined', { n: room.member_count, max: room.max_members })} {isHost ? t('room.host_hint') : t('room.guest_hint')}
            </p>
            <div className="action-row">
              {!me && <button className="btn" onClick={join} disabled={busy}>{t('room.join')}</button>}
              {isHost && <button className="btn gold" onClick={start} disabled={busy}>{t('room.start')}</button>}
              {me && <button className="btn ghost" onClick={leave} disabled={busy}>{t('room.leave_room')}</button>}
            </div>
          </>
        )}

        {status === 'running' && (
          <>
            <h2>{onBreak ? t('room.on_break') : me?.status === 'joined' ? t('room.focusing') : t('room.in_progress')}</h2>
            <p className="muted">{onBreak ? t('room.break_hint', { time: formatClock(breakLeft) }) : me?.status === 'joined' ? t('room.focus_hint') : t('room.watch_hint')}</p>
            {me?.status === 'joined' && !confirmLeave && (
              <div className="action-row">
                <button className="btn ghost" onClick={() => setConfirmLeave(true)}>{t('room.need_to_go')}</button>
              </div>
            )}
            {confirmLeave && (
              <div className="confirm">
                {lobbyGuard && <p><b>{t('room.lobby_guard')}</b></p>}
                <p>
                  {beforeHalfway
                    ? t('room.early_warn', { p: EARLY_LEAVE_PENALTY, time: formatClock(halfFocusMs - focusMs(serverNow)) })
                    : t('room.leave_ok', { n: focusExp(minutesSoFar) })}
                </p>
                <div className="action-row">
                  <button className="btn red" onClick={leave} disabled={busy}>{t('room.leave_btn', { exp: expText(leaveExp) })}</button>
                  <button className="btn" onClick={() => { setConfirmLeave(false); setLobbyGuard(false); }}>{t('room.keep')}</button>
                </div>
              </div>
            )}
          </>
        )}

        {status === 'finished' && !result && (
          <>
            <h2>{won ? t('room.bloomed') : t('room.times_up')}</h2>
            {me?.status === 'joined' && claimLeft > 0 && (
              <>
                <p className="muted">{t('room.harvest_within', { time: formatClock(claimLeft) })}</p>
                <div className="action-row">
                  <button className="btn gold harvest" onClick={claim} disabled={busy}>{t('room.harvest', { n: harvestExp })}</button>
                </div>
              </>
            )}
            {me?.status === 'joined' && claimLeft <= 0 && <p className="muted">{t('room.closed')}</p>}
            {me?.status === 'completed' && <p className="muted">{t('room.already')}</p>}
            {me?.status === 'left' && <p className="muted">{t('room.left_early')}</p>}
            {!me && <p className="muted">{t('room.over')}</p>}
          </>
        )}

        {status !== 'waiting' && (status === 'finished' || result) && (
          <div className="action-row">
            <Link to="/" className="btn ghost small">{t('room.back')}</Link>
          </div>
        )}

        {boss && (
          <div className="boss">
            <div className="row">
              <span className="pixel boss-name">{boss.name}</span>
              <span className="spacer" />
              <span className="pixel boss-hp">{bossHp === 0 ? t('room.defeated') : `${bossHp}/${boss.max_hp} HP`}</span>
            </div>
            <div className="bar boss-bar"><span style={{ width: `${(bossHp / boss.max_hp) * 100}%` }} /></div>
            <small className="muted">
              {bossHp === 0
                ? t('room.boss_gone')
                : `${t('room.boss_rule')}${status === 'running' ? ` ${t('room.focusing_now', { n: focusingNow })}` : ''}`}
            </small>
          </div>
        )}
      </section>
    </div>
  );
}
