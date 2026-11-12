import { useAuth } from '../auth.jsx';
import { useT } from '../i18n.jsx';
import MusicToggle from './MusicToggle.jsx';

// Fixed cluster in the top-right corner of every page: language, music, exit.
export default function TopBar() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useT();

  return (
    <div className="topbar">
      <button
        type="button"
        className="btn ghost small lang-btn"
        onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
        aria-label={t('top.lang')}
        title={t('top.lang')}
      >
        <span className={lang === 'en' ? 'on' : ''}>EN</span>/<span className={lang === 'th' ? 'on' : ''}>TH</span>
      </button>
      <MusicToggle />
      {user && (
        <button type="button" className="btn red small" onClick={logout}>
          {t('top.exit')}
        </button>
      )}
    </div>
  );
}
