// File: src/Style/Style.jsx
// Per-category writing style (Personal / Work / Email / Other) and the global
// Auto cleanup level. Card examples come from the backend's real formatter.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil } from 'lucide-react';
import { errorMessage, getStyles, updateStyle } from '../api/apiClient';
import { PageSpinner } from '../components/ui/Spinner';
import Tabs from '../components/ui/Tabs';
import AppsModal from './components/AppsModal';
import AutoCleanup from './components/AutoCleanup';
import StyleCard from './components/StyleCard';

const TABS = [
  { id: 'personal', label: 'Personal messages', banner: 'This style applies in personal messengers' },
  { id: 'work', label: 'Work messages', banner: 'This style applies in workplace messengers' },
  { id: 'email', label: 'Email', banner: 'This style applies in all major email apps' },
  { id: 'other', label: 'Other', banner: 'This style applies in all other apps' },
  { id: 'cleanup', label: 'Auto cleanup', banner: 'Auto Cleanup applies to all your dictations' },
];

export default function Style() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('personal');
  const [editingApps, setEditingApps] = useState(false);

  useEffect(() => {
    getStyles()
      .then(setData)
      .catch((err) => toast.error(errorMessage(err)));
  }, []);

  if (!data) return <PageSpinner />;
  const profile = data.styles.find((s) => s.category === tab);
  const current = TABS.find((t) => t.id === tab);

  const choose = async (style) => {
    const previous = data.styles;
    setData((d) => ({ ...d, styles: d.styles.map((s) => (s.category === tab ? { ...s, style } : s)) }));
    try {
      await updateStyle(tab, { style });
      toast.success('Style updated');
    } catch (err) {
      setData((d) => ({ ...d, styles: previous }));
      toast.error(errorMessage(err));
    }
  };

  const saveApps = async (appNames) => {
    const updated = await updateStyle(tab, { app_names: appNames });
    setData((d) => ({ ...d, styles: d.styles.map((s) => (s.category === tab ? updated : s)) }));
    toast.success('Apps updated');
  };

  return (
    <div>
      <h1 className="page-title">Style</h1>
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mt-6" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-subtle px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-ink">{current.banner}</p>
          {profile && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.app_names.length ? (
                profile.app_names.map((app) => (
                  <span key={app} className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs text-muted">
                    {app}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted">Every app that isn&apos;t in another category.</span>
              )}
            </div>
          )}
        </div>
        {profile && tab !== 'other' && (
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setEditingApps(true)}>
            <Pencil size={13} /> Edit apps
          </button>
        )}
      </div>

      {tab === 'cleanup' ? (
        <AutoCleanup examples={data.cleanup_examples} />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {data.examples[tab].map((ex) => (
            <StyleCard key={ex.style} category={tab} example={ex} selected={profile?.style === ex.style} onSelect={() => choose(ex.style)} />
          ))}
        </div>
      )}

      {profile && editingApps && (
        <AppsModal category={current.label} apps={profile.app_names} onClose={() => setEditingApps(false)} onSave={saveApps} />
      )}
    </div>
  );
}
