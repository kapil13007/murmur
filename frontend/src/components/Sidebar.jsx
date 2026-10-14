// File: src/components/Sidebar.jsx
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  BarChart3,
  Bell,
  BookOpen,
  Gift,
  HelpCircle,
  House,
  LogOut,
  NotebookPen,
  Scissors,
  Settings,
  Type,
  Users,
  Wand2,
} from 'lucide-react';
import { logout } from '../api/apiClient';
import { useApp } from '../context/AppContext';
import Logo from './Logo';
import Avatar from './ui/Avatar';
import HelpModal from './HelpModal';
import NotificationsDrawer from '../Notifications/NotificationsDrawer';

const NAV = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/dictionary', label: 'Dictionary', icon: BookOpen },
  { to: '/snippets', label: 'Snippets', icon: Scissors },
  { to: '/style', label: 'Style', icon: Type },
  { to: '/notes', label: 'Scratchpad', icon: NotebookPen },
  { to: '/transforms', label: 'Transforms', icon: Wand2 },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
];

const navClass = ({ isActive }) =>
  clsx(
    'flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition',
    isActive ? 'bg-panel text-ink shadow-panel' : 'text-muted hover:bg-subtle hover:text-ink',
  );

function PlanCard() {
  const { subscription } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  if (!subscription) return null;
  const openPlans = () => navigate('/settings/plans', { state: { background: location } });

  if (subscription.is_trial) {
    const total = subscription.total_trial_days || 14;
    const left = subscription.trial_days_left ?? 0;
    return (
      <div className="rounded-2xl border border-line bg-panel p-3.5">
        <p className="text-xs font-semibold text-muted">Pro Trial</p>
        <p className="mt-0.5 text-sm text-ink">
          Trial ends in <span className="font-semibold">{left} day{left === 1 ? '' : 's'}</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
          <div className="h-full rounded-full bg-fathom-600" style={{ width: `${Math.max(4, (left / total) * 100)}%` }} />
        </div>
        <button onClick={openPlans} className="btn-primary mt-3 w-full py-1.5 text-xs">
          Upgrade to Pro
        </button>
      </div>
    );
  }
  if (!subscription.is_pro) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-3.5">
        <p className="text-xs font-semibold text-muted">Flow Basic</p>
        <p className="mt-0.5 text-sm text-ink">{subscription.weekly_word_limit?.toLocaleString()} words / week</p>
        <button onClick={openPlans} className="btn-primary mt-3 w-full py-1.5 text-xs">
          Upgrade for unlimited
        </button>
      </div>
    );
  }
  return null;
}

export default function Sidebar() {
  const { user, subscription, unread } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const openSettings = (section) => navigate(`/settings/${section}`, { state: { background: location } });

  const planLabel = subscription?.is_trial ? 'Pro Trial' : subscription?.is_pro ? (subscription.is_student ? 'Student' : subscription.plan_name) : 'Basic';

  return (
    <aside className="flex w-[232px] shrink-0 flex-col px-3 pb-3 pt-5">
      <div className="mb-6 flex items-center justify-between px-2">
        <Logo />
        <span className="rounded-full border border-line bg-panel px-2 py-0.5 text-[11px] font-semibold text-muted">{planLabel}</span>
      </div>

      <nav aria-label="Main navigation" className="space-y-0.5">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
            <item.icon size={17} strokeWidth={1.9} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3">
        <PlanCard />
        <nav aria-label="Secondary navigation" className="space-y-0.5">
          <button onClick={() => openSettings('team')} className={navClass({ isActive: false })}>
            <Users size={17} strokeWidth={1.9} /> Invite your team
          </button>
          <NavLink to="/referral" className={navClass}>
            <Gift size={17} strokeWidth={1.9} /> Get a free month
          </NavLink>
          <button onClick={() => setNotificationsOpen(true)} className={clsx(navClass({ isActive: false }), 'w-full')}>
            <Bell size={17} strokeWidth={1.9} /> Notifications
            {unread > 0 && (
              <span className="ml-auto rounded-full bg-flare-400 px-1.5 text-[11px] font-semibold text-white">{unread}</span>
            )}
          </button>
          <button onClick={() => openSettings('general')} className={clsx(navClass({ isActive: false }), 'w-full')}>
            <Settings size={17} strokeWidth={1.9} /> Settings
          </button>
          <button onClick={() => setHelpOpen(true)} className={clsx(navClass({ isActive: false }), 'w-full')}>
            <HelpCircle size={17} strokeWidth={1.9} /> Help
          </button>
        </nav>
        {user && (
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <Avatar name={user.full_name} src={user.avatar_url} size={28} />
            <button onClick={() => openSettings('account')} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-ink">{user.full_name}</p>
              <p className="truncate text-xs text-faint">{user.email}</p>
            </button>
            <button onClick={logout} className="rounded-lg p-1.5 text-faint hover:bg-subtle hover:text-ink" title="Log out" aria-label="Log out">
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      {notificationsOpen && <NotificationsDrawer onClose={() => setNotificationsOpen(false)} />}
    </aside>
  );
}
