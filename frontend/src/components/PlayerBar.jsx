import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth.jsx';
import { EXP_PER_LEVEL, MAX_LEVEL } from '../constants.js';
import { useT } from '../i18n.jsx';
import Avatar from './Avatar.jsx';

// Avatar + name + level + EXP bar, with links to garden, friends and the character editor
export default function PlayerBar() {
  const { user } = useAuth();
  const { t } = useT();
  const maxed = user.level >= MAX_LEVEL;
  const expInLevel = maxed ? EXP_PER_LEVEL : user.exp % EXP_PER_LEVEL;
  const [incoming, setIncoming] = useState(0);

  useEffect(() => {
    api.friends().then((f) => setIncoming(f.incoming.length)).catch(() => {});
  }, []);

  return (
    <header className="panel player-bar">
      <Link to="/avatar" title={t('bar.edit_title')}>
        <Avatar avatar={user.avatar} size={56} />
      </Link>
      <div className="player-info">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <h2>{user.display_name}</h2>
          <span className="chip gold-chip">LV.{user.level}{maxed ? ' MAX' : ''}</span>
        </div>
        <div className="bar" aria-label={`${expInLevel} / ${EXP_PER_LEVEL} EXP`}>
          <span style={{ width: `${expInLevel}%` }} />
        </div>
        <small className="muted">{maxed ? t('bar.max') : `${expInLevel} / ${EXP_PER_LEVEL} EXP`}</small>
      </div>
      <nav className="player-nav">
        <Link to="/garden" className="btn ghost small">{t('bar.garden')}</Link>
        <Link to="/friends" className="btn ghost small badge-wrap">
          {t('bar.friends')}
          {incoming > 0 && <span className="badge">{incoming}</span>}
        </Link>
        <Link to="/avatar" className="btn ghost small">{t('bar.edit')}</Link>
      </nav>
    </header>
  );
}
