import { TREES } from '../constants.js';
import Avatar from './Avatar.jsx';
import { treeArt } from '../scene/art.js';
import { useT } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { BOSS_MIN_LEVEL } from '../rules.js';

const ICON = import.meta.env.BASE_URL + 'icons/';

export default function RoomCard({ room, onJoin, joining }) {
  const { t } = useT();
  const treeName = t(`tree.${TREES[room.tree_type] ? room.tree_type : 'cactus'}`);
  const full = room.member_count >= room.max_members;
  const running = room.status === 'running';
  const { user } = useAuth();
  const tooLow = room.boss_id && (user?.level ?? 1) < BOSS_MIN_LEVEL; // boss rooms: Lv.30+

  let button;
  if (running) button = <button className="btn ghost small" disabled>{t('card.in_progress')}</button>;
  else if (tooLow) button = <button className="btn ghost small" disabled>Lv.{BOSS_MIN_LEVEL}</button>;
  else if (full) button = <button className="btn red small" disabled>{t('card.full')}</button>;
  else button = (
    <button className="btn small" onClick={() => onJoin(room)} disabled={joining}>
      {joining ? '...' : t('card.join')}
    </button>
  );

  return (
    <article className="panel room-card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="tree-badge" title={treeName}>
          <img src={treeArt(room.tree_type, 3)} alt={treeName} className="pixelated" />
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 className="room-title">{room.title}</h3>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            <span className="chip blue">{room.topic}</span>
            {room.boss_id && <span className="chip red">{t('card.boss')}</span>}
            {room.chat_enabled === false && <span className="chip">{t('card.focus_mode')}</span>}
          </div>
        </div>
      </div>

      <ul className="room-meta">
        <li><img src={`${ICON}clock.png`} alt="" className="ico" />{room.duration_minutes} {t('common.min')}</li>
        <li><img src={`${ICON}pin.png`} alt="" className="ico" />{room.location || t('common.online')}</li>
      </ul>

      {/* seats as pixel dots */}
      <div className="row" style={{ gap: 4 }} aria-label={t('card.seats', { n: room.member_count, max: room.max_members })}>
        {Array.from({ length: room.max_members }, (_, i) => (
          <span key={i} className={`seat ${i < room.member_count ? 'taken' : ''}`} />
        ))}
        <span className="pixel" style={{ fontSize: 9, marginLeft: 6 }}>
          {room.member_count}/{room.max_members}
        </span>
      </div>

      <footer className="row room-footer">
        <Avatar avatar={room.host.avatar} size={28} />
        <small className="muted" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t('card.host', { name: room.host.display_name, lv: room.host.level })}
        </small>
        <span className="spacer" />
        {button}
      </footer>
    </article>
  );
}
