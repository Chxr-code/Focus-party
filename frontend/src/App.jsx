import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Lobby from './pages/Lobby.jsx';
import Room from './pages/Room.jsx';
import AvatarEditor from './pages/AvatarEditor.jsx';
import Garden from './pages/Garden.jsx';
import TopBar from './components/TopBar.jsx';
import Friends from './pages/Friends.jsx';
import { useT } from './i18n.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const { t } = useT();
  if (loading) return <p className="pixel" style={{ textAlign: 'center', marginTop: 80 }}>{t('common.loading')}</p>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
    <TopBar />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Lobby /></RequireAuth>} />
      <Route path="/room/:id" element={<RequireAuth><Room /></RequireAuth>} />
      <Route path="/avatar" element={<RequireAuth><AvatarEditor /></RequireAuth>} />
      <Route path="/garden" element={<RequireAuth><Garden /></RequireAuth>} />
      <Route path="/garden/:userId" element={<RequireAuth><Garden /></RequireAuth>} />
      <Route path="/friends" element={<RequireAuth><Friends /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
