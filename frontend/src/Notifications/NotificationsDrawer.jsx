// File: src/Notifications/NotificationsDrawer.jsx
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Archive, Bell, CheckCheck, X } from 'lucide-react';
import clsx from 'clsx';
import {
  archiveAllNotifications,
  archiveNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/apiClient';
import { useApp } from '../context/AppContext';
import { onServerEvent } from '../hooks/useServerEvents';
import { relativeTime } from '../utils/formatter';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';

const TYPE_DOT = {
  milestone: 'bg-glow-300',
  learning: 'bg-fathom-500',
  team: 'bg-dawn-700',
  usage: 'bg-flare-400',
  billing: 'bg-chord-500',
  tip: 'bg-signal-500',
  feature: 'bg-fathom-800',
  system: 'bg-vast-400',
};

// Mounted only while open (see Sidebar), so every open shows fresh data.
export default function NotificationsDrawer({ onClose }) {
  const { setUnread } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState(null);

  const load = useCallback(
    () =>
      getNotifications().then((res) => {
        setItems(res.items);
        setUnread(res.unread_count);
      }),
    [setUnread],
  );

  useEffect(() => {
    getNotifications()
      .then((res) => {
        setItems(res.items);
        setUnread(res.unread_count);
      })
      .catch(() => setItems([]));
  }, [setUnread]);
  useEffect(() => onServerEvent('notification', () => load()), [load]);

  const open = async (n) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      load();
    }
    if (n.action_url) {
      onClose();
      if (n.action_url.startsWith('/settings')) navigate(n.action_url, { state: { background: location } });
      else navigate(n.action_url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 animate-fade-in bg-vast-950/20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="absolute left-[244px] top-2 flex max-h-[80vh] w-[380px] animate-pop-in flex-col rounded-2xl bg-panel shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <p className="font-semibold text-ink">Notifications</p>
          <div className="flex items-center gap-1">
            <button
              className="rounded-lg p-1.5 text-faint hover:bg-subtle hover:text-ink"
              title="Mark all as read"
              onClick={async () => {
                await markAllNotificationsRead();
                load();
              }}
            >
              <CheckCheck size={16} />
            </button>
            <button
              className="rounded-lg p-1.5 text-faint hover:bg-subtle hover:text-ink"
              title="Archive all"
              onClick={async () => {
                await archiveAllNotifications();
                load();
              }}
            >
              <Archive size={16} />
            </button>
            <button className="rounded-lg p-1.5 text-faint hover:bg-subtle hover:text-ink" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {!items ? (
            <Spinner className="p-4" />
          ) : !items.length ? (
            <div className="p-3">
              <EmptyState icon={Bell} title="You're all caught up" body="Milestones, tips and team updates show up here." />
            </div>
          ) : (
            items.map((n) => (
              <div key={n.id} className={clsx('group relative rounded-xl px-3 py-3 hover:bg-subtle/70', !n.is_read && 'bg-dawn-100/60 dark:bg-vast-800')}>
                <button className="flex w-full gap-3 text-left" onClick={() => open(n)}>
                  <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', TYPE_DOT[n.type], n.is_read && 'opacity-30')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{n.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                    <span className="mt-1 block text-xs text-faint">
                      {relativeTime(n.created_at)}
                      {n.action_label && <span className="ml-2 font-semibold text-ink">{n.action_label} →</span>}
                    </span>
                  </span>
                </button>
                <button
                  className="absolute right-2 top-2 rounded-lg p-1 text-faint opacity-0 hover:bg-panel hover:text-ink group-hover:opacity-100"
                  title="Archive"
                  onClick={async () => {
                    await archiveNotification(n.id);
                    load();
                  }}
                >
                  <Archive size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
