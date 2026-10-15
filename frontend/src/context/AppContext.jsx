// File: src/context/AppContext.jsx
// Signed-in user and preferences, shared by every screen.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import * as api from '../api/apiClient';
import { desktop } from '../desktop/bridge';
import { onServerEvent, useServerEvents } from '../hooks/useServerEvents';

const AppContext = createContext(null);

function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [unread, setUnread] = useState(0);
  // Only signed-in visitors need to wait for /users/me.
  const [loading, setLoading] = useState(() => Boolean(api.getToken()));

  const refresh = useCallback(
    () =>
      Promise.all([api.getMe(), api.getPreferences()]).then(([me, prefs]) => {
        setUser(me.user);
        setUnread(me.unread_notifications);
        setPreferences(prefs);
        return me;
      }),
    [],
  );

  useEffect(() => {
    if (!api.getToken()) return;
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);

  useServerEvents(Boolean(user));

  // Keep the desktop shell in sync with the signed-in session and settings.
  useEffect(() => {
    if (user && desktop) desktop.setSession?.(api.getToken());
  }, [user]);
  useEffect(() => {
    if (preferences) {
      applyTheme(preferences.theme);
      desktop?.preferencesChanged?.(preferences);
    }
  }, [preferences]);

  useEffect(
    () =>
      onServerEvent('preferences.updated', (prefs) => setPreferences(prefs)),
    [],
  );
  useEffect(
    () =>
      onServerEvent('notification', (n) => {
        setUnread((u) => u + 1);
        toast(n.title, { icon: '🔔' });
      }),
    [],
  );

  const savePreferences = useCallback(async (changes) => {
    const previous = preferences;
    setPreferences((p) => ({ ...p, ...changes, shortcuts: changes.shortcuts ? { ...p.shortcuts, ...changes.shortcuts } : p.shortcuts }));
    try {
      const saved = await api.updatePreferences(changes);
      setPreferences(saved);
      return saved;
    } catch (err) {
      setPreferences(previous);
      toast.error(api.errorMessage(err));
      err.handled = true;
      throw err;
    }
  }, [preferences]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      preferences,
      savePreferences,
      unread,
      setUnread,
      loading,
      refresh,
      isDesktop: Boolean(desktop),
    }),
    [user, preferences, savePreferences, unread, loading, refresh],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
