import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemePicker, loadBackground, saveBackground, usePageBackground } from '../scene/pageBackground.jsx';
import { api, ApiError } from '../api/client';
import PlayerBar from '../components/PlayerBar.jsx';
import AdminPanel from '../components/AdminPanel.jsx';
import RoomCard from '../components/RoomCard.jsx';
import CreateRoomModal from '../components/CreateRoomModal.jsx';
import { useT } from '../i18n.jsx';
import './lobby.css';
import { treeArt } from '../scene/art.js';

const TABS = [
  { key: 'waiting', label: 'lobby.open' },
  { key: 'running', label: 'lobby.running' },
];

export default function Lobby() {
  const navigate = useNavigate();
  const [pageBg, setPageBg] = useState(() => loadBackground('lobby'));
  const [showTheme, setShowTheme] = useState(false);
  usePageBackground(pageBg);
  const { t } = useT();
  const [tab, setTab] = useState('waiting');
  const [topic, setTopic] = useState('');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setRooms(await api.listRooms({ status: tab, topic: topic.trim() || undefined }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, topic]);

  // reload when filters change (debounced for typing), and refresh every 10s
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(load, 300);
    const interval = setInterval(load, 10_000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [load]);

  async function join(room) {
    setJoiningId(room.id);
    try {
      await api.joinRoom(room.id);
      navigate(`/room/${room.id}`);
    } catch (err) {
      // already a member → just go in
      if (err instanceof ApiError && err.message.toLowerCase().includes('already in')) {
        navigate(`/room/${room.id}`);
      } else {
        setError(err.message);
        load();
      }
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="container">
      <PlayerBar />
      <AdminPanel />

      <section className="lobby-head">
        <div>
          <h1>{t('lobby.title')}</h1>
          <p className="lobby-sub">{t('lobby.sub')}</p>
        </div>
        <button className="btn gold" onClick={() => setShowCreate(true)}>{t('lobby.create')}</button>
      </section>

      <div className="lobby-controls">
        <div className="tabs" role="tablist">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              role="tab"
              aria-selected={tab === tb.key}
              className={`btn small ${tab === tb.key ? '' : 'ghost'}`}
              onClick={() => setTab(tb.key)}
            >
              {t(tb.label)}
            </button>
          ))}
        </div>
        <input
          className="input search"
          placeholder={t('lobby.search')}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          aria-label={t('lobby.search')}
        />
        <button className={`btn small ${showTheme ? 'gold' : 'ghost'}`} onClick={() => setShowTheme((v) => !v)} aria-expanded={showTheme}>
          {t('lobby.theme')}
        </button>
      </div>

      {showTheme && (
        <div className="panel lobby-theme">
          <ThemePicker
            value={pageBg}
            onChange={(key) => { setPageBg(key); saveBackground('lobby', key); }}
            t={t}
            label={t('lobby.theme')}
          />
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {loading && rooms.length === 0 ? (
        <p className="pixel empty">{t('lobby.loading')}</p>
      ) : rooms.length === 0 ? (
        <div className="panel empty-panel">
          <img src={treeArt('cactus', 1)} alt="" className="pixelated" style={{ width: 64, height: 64 }} />
          <h3>{t('lobby.empty')}</h3>
          <p className="muted">{t('lobby.empty_sub')}</p>
          <button className="btn" onClick={() => setShowCreate(true)}>{t('lobby.create')}</button>
        </div>
      ) : (
        <div className="room-grid">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} onJoin={join} joining={joiningId === room.id} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={(room) => navigate(`/room/${room.id}`)}
        />
      )}
    </div>
  );
}
