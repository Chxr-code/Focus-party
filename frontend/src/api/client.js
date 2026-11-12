// The ONLY place pages talk to the backend.
// Pages import { api } from './api/client' and never call axios/fetch directly.
// Switch mock <-> real with VITE_USE_MOCK in .env

import axios from 'axios';
import { ApiError, getToken, setToken, clearToken } from './shared.js';
import { mockApi, mockDebug } from './mock.js';
import {
  bossPayload, normalizeBoss, normalizeErrors, normalizeFriends, normalizeGarden, normalizeRoom, normalizeUser, roomPayload, toIso,
} from './normalize.js';

const env = import.meta.env ?? {};
// No .env setting → `npm run dev` uses mock data, `npm run build` (the deployed site) uses the real API.
export const USE_MOCK = env.VITE_USE_MOCK ? env.VITE_USE_MOCK === 'true' : Boolean(env.DEV);

const http = axios.create({
  baseURL: env.VITE_API_BASE || '/api',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Success: unwrap {"data": ...}. Error: turn {"message","errors"} into ApiError.
http.interceptors.response.use(
  (res) => res.data?.data,
  (err) => {
    const status = err.response?.status ?? 0;
    const body = err.response?.data ?? {};
    if (status === 401) clearToken();
    const message = body.message || (status ? 'Request failed' : 'Cannot reach server');
    return Promise.reject(new ApiError(status, message, normalizeErrors(body.errors)));
  },
);

// Every response goes through normalize.js so pages get the same shape as the mock.
const authResult = (res) => ({ ...res, user: normalizeUser(res.user) });
const roomResult = (res) => ({ ...res, room: normalizeRoom(res.room), user: normalizeUser(res.user) });
const unwrapList = (res, key) => (Array.isArray(res) ? res : res?.[key] ?? []);

const realApi = {
  // auth
  register: async (payload) => authResult(await http.post('/auth/register', payload)),
  login: async (payload) => authResult(await http.post('/auth/login', payload)),

  // me
  me: async () => normalizeUser(await http.get('/me')),
  updateAvatar: async (avatar) => {
    const res = await http.put('/me/avatar', { avatar });
    return res?.username ? normalizeUser(res) : { avatar: res?.avatar ?? avatar };
  },
  // only sessions that are over belong in the garden (the API also lists rooms still running)
  garden: async () => normalizeGarden(await http.get('/me/garden')),
  userGarden: async (userId) => {
    const res = await http.get(`/users/${userId}/garden`);
    return { user: normalizeUser(res.user), trees: normalizeGarden(res.trees) };
  },
  waterGarden: async () => normalizeGarden(await http.post('/me/garden/water')),
  renameTree: async (roomId, name) => normalizeGarden([await http.put(`/me/garden/${roomId}`, { name })])[0],

  // rooms — topic search is done here so partial matches work ("calc" finds "Calculus")
  listRooms: async ({ status, topic } = {}) => {
    const rooms = unwrapList(await http.get('/rooms', { params: { status } }), 'rooms').map(normalizeRoom);
    const q = topic?.trim().toLowerCase();
    return q ? rooms.filter((r) => r.topic.toLowerCase().includes(q) || r.title.toLowerCase().includes(q)) : rooms;
  },
  createRoom: async (payload) => normalizeRoom(await http.post('/rooms', roomPayload(payload))),
  getRoom: async (id) => normalizeRoom(await http.get(`/rooms/${id}`)),
  joinRoom: async (id) => normalizeRoom(await http.post(`/rooms/${id}/join`)),
  startRoom: async (id) => normalizeRoom(await http.post(`/rooms/${id}/start`)),
  leaveRoom: async (id) => roomResult(await http.post(`/rooms/${id}/leave`)),
  claimRoom: async (id) => roomResult(await http.post(`/rooms/${id}/claim`)),

  // friends
  friends: async () => normalizeFriends(await http.get('/friends')),
  sendFriendRequest: async (userId) => normalizeFriends(await http.post('/friends/requests', { user_id: userId })),
  respondFriendRequest: async (requestId, accept) =>
    normalizeFriends(await http.post(`/friends/requests/${requestId}/${accept ? 'accept' : 'decline'}`)),
  removeFriend: async (userId) => normalizeFriends(await http.delete(`/friends/${userId}`)),
  updateSettings: async (settings) => normalizeUser(await http.put('/me/settings', settings)),

  // room chat (polled every few seconds — works on a plain PHP server, no WebSocket needed)
  listMessages: async (roomId, afterId = 0) =>
    unwrapList(await http.get(`/rooms/${roomId}/messages`, { params: { after_id: afterId } }), 'messages')
      .map((m) => ({ ...m, created_at: toIso(m.created_at) })),
  sendMessage: async (roomId, body) => {
    const m = await http.post(`/rooms/${roomId}/messages`, { body });
    return { ...m, created_at: toIso(m.created_at) };
  },

  // admin
  adminSetLevel: async (level) => normalizeUser(await http.put('/admin/level', { level })),

  // bosses
  listBosses: async () => unwrapList(await http.get('/bosses'), 'bosses').map(normalizeBoss),
  createBoss: async (payload) => {
    const res = await http.post('/bosses', bossPayload(payload));
    return normalizeBoss(res?.boss ?? res);
  },
  getBoss: async (id) => {
    const res = await http.get(`/bosses/${id}`);
    return normalizeBoss(res?.boss ?? res);
  },
};

const base = USE_MOCK ? mockApi : realApi;

export const api = {
  ...base,
  async login(payload) {
    const res = await base.login(payload);
    setToken(res.token);
    return res;
  },
  async register(payload) {
    const res = await base.register(payload);
    setToken(res.token);
    return res;
  },
  logout() {
    clearToken();
  },
  isLoggedIn() {
    return Boolean(getToken());
  },
};

// Dev-only helpers (reset mock data, end a room instantly). Null when using the real API.
export const devTools = USE_MOCK ? mockDebug : null;

export { ApiError };
