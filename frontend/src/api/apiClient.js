// File: src/api/apiClient.js
// Single place every screen talks to the Express API through.
import axios from 'axios';
import { desktop } from '../desktop/bridge';

export const API_BASE_URL = desktop?.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || '/api/v1';

// localStorage for "Remember me" (and the desktop app), sessionStorage for a
// single browser-tab session.
export const getToken = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');

export function saveToken(token, remember = true) {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem('accessToken', token);
  desktop?.setSession?.(token);
}

export function clearToken() {
  localStorage.removeItem('accessToken');
  sessionStorage.removeItem('accessToken');
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const onAuthPage = ['/login', '/register'].includes(window.location.pathname);
    if (error.response?.status === 401 && getToken() && !onAuthPage) {
      clearToken();
      desktop?.clearSession?.();
      window.location.href = '/login?expired=1';
    }
    return Promise.reject(error);
  },
);

// Human-readable message from any API error.
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (error?.message === 'Network Error') return "Can't reach the Whisper Flow server. Is the backend running?";
  return fallback;
}

const data = (promise) => promise.then((res) => res.data);

// --- Authentication ---
export const login = async (email, password, rememberMe = true) => {
  const res = await apiClient.post('/auth/login', { email, password, remember_me: rememberMe });
  saveToken(res.data.access_token, rememberMe);
  return res.data;
};
export const register = async (payload) => {
  const res = await apiClient.post('/auth/register', {
    ...payload,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  saveToken(res.data.access_token, true);
  return res.data;
};
export const logout = () => {
  clearToken();
  desktop?.clearSession?.();
  window.location.href = '/login';
};
export const changePassword = async (payload) => {
  const res = await apiClient.post('/auth/change-password', payload);
  saveToken(res.data.access_token, Boolean(localStorage.getItem('accessToken')));
  return res.data;
};
export const logoutEverywhere = () => data(apiClient.post('/auth/logout-all'));

// --- Account ---
export const getMe = () => data(apiClient.get('/users/me'));
export const updateProfile = (payload) => data(apiClient.patch('/users/me', payload));
export const completeOnboarding = (payload) => data(apiClient.post('/users/me/onboarding', payload));
export const restartOnboarding = () => data(apiClient.post('/users/me/onboarding/reset'));
export const deleteAccount = (password) => data(apiClient.delete('/users/me', { data: { password } }));
export const getPreferences = () => data(apiClient.get('/preferences'));
export const updatePreferences = (changes) => data(apiClient.patch('/preferences', changes));
export const getDevices = () => data(apiClient.get('/devices'));
export const removeDevice = (id) => apiClient.delete(`/devices/${id}`);

// --- Dictation ---
export const transcribeAudio = (wavBlob, context = {}) => {
  const form = new FormData();
  form.append('audio', wavBlob, 'dictation.wav');
  Object.entries({ mode: 'web', platform: 'web', ...context }).forEach(([k, v]) => {
    if (v !== undefined && v !== null) form.append(k, String(v));
  });
  return data(apiClient.post('/dictation/transcribe', form, { headers: { 'Content-Type': 'multipart/form-data' } }));
};
export const runCommand = ({ wavBlob, instruction, selectedText, appName }) => {
  const form = new FormData();
  if (wavBlob) form.append('audio', wavBlob, 'command.wav');
  if (instruction) form.append('instruction', instruction);
  form.append('selected_text', selectedText || '');
  form.append('mode', 'command');
  if (appName) form.append('app_name', appName);
  return data(apiClient.post('/dictation/command', form, { headers: { 'Content-Type': 'multipart/form-data' } }));
};
export const formatText = (payload) => data(apiClient.post('/dictation/format', payload));

// --- History ---
export const getHistory = (params) => data(apiClient.get('/history', { params }));
export const getLastTranscript = () => data(apiClient.get('/history/last'));
export const updateTranscript = (id, changes) => data(apiClient.patch(`/history/${id}`, changes));
export const deleteTranscript = (id) => apiClient.delete(`/history/${id}`);
export const retryTranscript = (id) => data(apiClient.post(`/history/${id}/retry`));
export const getTranscriptAudio = (id) => data(apiClient.get(`/history/${id}/audio`, { responseType: 'blob' }));

// --- Stats / Insights ---
export const getStatsSummary = () => data(apiClient.get('/stats/summary'));
export const getHeatmap = (days = 371) => data(apiClient.get('/stats/heatmap', { params: { days } }));
export const getTopApps = () => data(apiClient.get('/stats/apps'));
export const getWeeklyUsage = () => data(apiClient.get('/stats/usage'));

// --- Dictionary & Snippets (same API shape, different collection) ---
const entryApi = (base) => ({
  list: (params) => data(apiClient.get(base, { params })),
  create: (payload) => data(apiClient.post(base, payload)),
  update: (id, changes) => data(apiClient.put(`${base}/${id}`, changes)),
  remove: (id) => apiClient.delete(`${base}/${id}`),
  bulkDelete: (ids) => data(apiClient.post(`${base}/bulk-delete`, { ids })),
  share: (ids) => data(apiClient.post(`${base}/share`, { ids })),
  unshare: (ids) => data(apiClient.post(`${base}/unshare`, { ids })),
  importText: (text) => data(apiClient.post(`${base}/import`, { text })),
});
export const dictionaryApi = entryApi('/dictionary');
export const snippetsApi = entryApi('/snippets');

// --- Style ---
export const getStyles = () => data(apiClient.get('/styles'));
export const updateStyle = (category, changes) => data(apiClient.put(`/styles/${category}`, changes));

// --- Notes (Scratchpad) ---
export const getNotes = (params) => data(apiClient.get('/notes', { params }));
export const getNote = (id) => data(apiClient.get(`/notes/${id}`));
export const createNote = (payload) => data(apiClient.post('/notes', payload));
export const updateNote = (id, changes) => data(apiClient.patch(`/notes/${id}`, changes));
export const deleteNote = (id) => apiClient.delete(`/notes/${id}`);
export const getNoteVersions = (id) => data(apiClient.get(`/notes/${id}/versions`));
export const restoreNoteVersion = (id, versionId) => data(apiClient.post(`/notes/${id}/versions/${versionId}/restore`));
export const transformNote = (id, payload) => data(apiClient.post(`/notes/${id}/transform`, payload));

// --- Transforms ---
export const getTransforms = () => data(apiClient.get('/transforms'));
export const createTransform = (payload) => data(apiClient.post('/transforms', payload));
export const updateTransform = (id, changes) => data(apiClient.patch(`/transforms/${id}`, changes));
export const deleteTransform = (id) => apiClient.delete(`/transforms/${id}`);
export const applyTransform = (payload) => data(apiClient.post('/transforms/apply', payload));
export const getTransformHistory = () => data(apiClient.get('/transforms/history'));
export const getCommandHistory = () => data(apiClient.get('/transforms/commands'));

// --- Notifications ---
export const getNotifications = () => data(apiClient.get('/notifications'));
export const markNotificationRead = (id) => data(apiClient.post(`/notifications/${id}/read`));
export const archiveNotification = (id) => data(apiClient.post(`/notifications/${id}/archive`));
export const markAllNotificationsRead = () => apiClient.post('/notifications/read-all');
export const archiveAllNotifications = () => apiClient.post('/notifications/archive-all');

// --- Plans & Billing ---
export const getPlans = () => data(apiClient.get('/billing/plans'));
export const getSubscription = () => data(apiClient.get('/billing/subscription'));
export const getBillingHistory = () => data(apiClient.get('/billing/history'));
export const checkout = (payload) => data(apiClient.post('/billing/checkout', payload));
export const cancelSubscription = () => data(apiClient.post('/billing/cancel'));
export const resumeSubscription = () => data(apiClient.post('/billing/resume'));
export const claimStudentPlan = () => data(apiClient.post('/billing/student'));

// --- Team ---
export const getMyTeam = () => data(apiClient.get('/teams/me'));
export const createTeam = (name) => data(apiClient.post('/teams', { name }));
export const renameTeam = (name) => data(apiClient.patch('/teams', { name }));
export const inviteToTeam = (emails) => data(apiClient.post('/teams/invite', { emails }));
export const joinTeam = (inviteCode) => data(apiClient.post('/teams/join', { invite_code: inviteCode }));
export const leaveTeam = () => data(apiClient.post('/teams/leave'));
export const regenerateInviteCode = () => data(apiClient.post('/teams/invite-code/regenerate'));
export const acceptInvitation = (id) => data(apiClient.post(`/teams/invitations/${id}/accept`));
export const declineInvitation = (id) => data(apiClient.post(`/teams/invitations/${id}/decline`));
export const revokeInvitation = (id) => data(apiClient.delete(`/teams/invitations/${id}`));
export const setMemberRole = (userId, role) => data(apiClient.patch(`/teams/members/${userId}`, { role }));
export const removeMember = (userId) => data(apiClient.delete(`/teams/members/${userId}`));

// --- Referrals ---
export const getReferrals = () => data(apiClient.get('/referrals'));
export const inviteReferral = (email) => data(apiClient.post('/referrals/invite', { email }));

// --- Data & Privacy ---
export const exportData = () => data(apiClient.get('/data/export'));
export const deleteAllHistory = () => data(apiClient.delete('/data/history'));

// --- System ---
export const getHealth = () => data(apiClient.get('/system/health'));

export default apiClient;
