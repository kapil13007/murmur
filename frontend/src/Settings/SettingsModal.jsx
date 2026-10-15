// File: src/Settings/SettingsModal.jsx
// Settings as a large modal over the current page.
import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Shield, SlidersHorizontal, Monitor, UserRound, X } from 'lucide-react';
import clsx from 'clsx';
import AccountSettings from './components/AccountSettings';
import GeneralSettings from './components/GeneralSettings';
import PrivacySettings from './components/PrivacySettings';
import SystemSettings from './components/SystemSettings';

const GROUPS = [
  {
    label: 'Settings',
    items: [
      { id: 'general', label: 'General', icon: SlidersHorizontal, Component: GeneralSettings },
      { id: 'system', label: 'System', icon: Monitor, Component: SystemSettings },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'account', label: 'Account', icon: UserRound, Component: AccountSettings },
      { id: 'privacy', label: 'Data and Privacy', icon: Shield, Component: PrivacySettings },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);

export default function SettingsModal() {
  const { section = 'general' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const background = location.state?.background;
  const active = ALL.find((s) => s.id === section) || ALL[0];

  const close = () => navigate(background ? `${background.pathname}${background.search || ''}` : '/');
  const go = (id) => navigate(`/settings/${id}`, { replace: true, state: { background } });

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('[role="dialog"] [role="dialog"]') && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-vast-950/40 p-6 backdrop-blur-[2px] animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="Settings" className="flex h-[min(760px,88vh)] w-full max-w-5xl animate-pop-in overflow-hidden rounded-2xl bg-panel shadow-pop">
        <nav className="w-56 shrink-0 overflow-y-auto border-r border-line bg-canvas/60 p-3">
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="section-label px-3 pb-1.5 pt-2">{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={clsx(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition',
                    active.id === item.id ? 'bg-panel text-ink shadow-panel' : 'text-muted hover:bg-subtle hover:text-ink',
                  )}
                >
                  <item.icon size={16} strokeWidth={1.9} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-8 pb-2 pt-6">
            <h2 className="font-display text-[28px] text-ink">{active.label}</h2>
            <button onClick={close} className="rounded-lg p-1.5 text-faint hover:bg-subtle hover:text-ink" aria-label="Close settings">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-8 pb-8">
            <active.Component />
          </div>
        </div>
      </div>
    </div>
  );
}
