// File: src/components/Sidebar.jsx
// Left navigation. The middle scrolls when the window is short (or zoomed in)
// so the profile row is always visible at the bottom.
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, BookOpen, ChevronsUpDown, HelpCircle, House, LogOut, Scissors, Settings, Type, UserRound, Wand2 } from 'lucide-react';
import { logout } from '../api/apiClient';
import { useApp } from '../context/AppContext';
import Logo from './Logo';
import Avatar from './ui/Avatar';
import Menu from './ui/Menu';
import HelpModal from './HelpModal';
import NotificationsDrawer from '../Notifications/NotificationsDrawer';

const NAV = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/dictionary', label: 'Dictionary', icon: BookOpen },
  { to: '/snippets', label: 'Snippets', icon: Scissors },
  { to: '/style', label: 'Style', icon: Type },
  { to: '/transforms', label: 'Transforms', icon: Wand2 },
];

const navClass = ({ isActive }) =>
  clsx(
    'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition',
    isActive ? 'bg-panel text-ink shadow-panel' : 'text-muted hover:bg-subtle hover:text-ink',
  );

export default function Sidebar() {
  const { user, unread } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const openSettings = (section) => navigate(`/settings/${section}`, { state: { background: location } });

  return (
    <aside className="flex h-full min-h-0 w-[232px] shrink-0 flex-col px-3 pb-3 pt-5">
      <div className="mb-6 shrink-0 px-2">
        <Logo />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <nav aria-label="Main navigation" className="space-y-0.5">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              <item.icon size={17} strokeWidth={1.9} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="shrink-0 space-y-3 pt-3">
        <nav aria-label="Secondary navigation" className="space-y-0.5">
          <button onClick={() => setNotificationsOpen(true)} className={navClass({ isActive: false })}>
            <Bell size={17} strokeWidth={1.9} /> Notifications
            {unread > 0 && (
              <span className="ml-auto rounded-full bg-flare-400 px-1.5 text-[11px] font-semibold text-white">{unread}</span>
            )}
          </button>
          <button onClick={() => openSettings('general')} className={navClass({ isActive: false })}>
            <Settings size={17} strokeWidth={1.9} /> Settings
          </button>
        </nav>

        {user && (
          <Menu
            placement="top"
            align="left"
            width="w-[208px]"
            trigger={
              <button
                className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-panel px-2.5 py-2 text-left transition hover:bg-subtle"
                aria-label="Profile menu"
              >
                <Avatar name={user.full_name} src={user.avatar_url} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{user.full_name}</span>
                  <span className="block truncate text-xs text-faint">{user.email}</span>
                </span>
                <ChevronsUpDown size={14} className="shrink-0 text-faint" />
              </button>
            }
            items={[
              { label: 'Account', icon: UserRound, onClick: () => openSettings('account') },
              { label: 'Help & shortcuts', icon: HelpCircle, onClick: () => setHelpOpen(true) },
              { divider: true },
              { label: 'Log out', icon: LogOut, danger: true, onClick: logout },
            ]}
          />
        )}
      </div>
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      {notificationsOpen && <NotificationsDrawer onClose={() => setNotificationsOpen(false)} />}
    </aside>
  );
}
