// File: src/Onboarding/components/PrivacyStep.jsx
import clsx from 'clsx';
import { useApp } from '../../context/AppContext';
import Toggle from '../../components/ui/Toggle';

const OPTIONS = [
  ['store', 'Store my dictations', 'Search, edit and retry your history. Recordings are kept for 14 days.'],
  ['auto_delete_24h', 'Auto-delete after 24 hours', 'Keep only the last day of history.'],
  ['never_store', 'Never store anything', 'Dictation works, but nothing is saved.'],
];

export default function PrivacyStep() {
  const { preferences, savePreferences } = useApp();
  if (!preferences) return null;
  return (
    <div className="space-y-2">
      {OPTIONS.map(([id, label, description]) => (
        <button
          key={id}
          onClick={() => savePreferences({ data_retention: id })}
          className={clsx(
            'flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition',
            preferences.data_retention === id ? 'border-ink bg-raised' : 'border-line bg-panel hover:border-vast-300',
          )}
        >
          <span className={clsx('mt-1 h-4 w-4 shrink-0 rounded-full border-2', preferences.data_retention === id ? 'border-ink bg-ink' : 'border-vast-300')} />
          <span>
            <span className="block font-medium text-ink">{label}</span>
            <span className="block text-sm text-muted">{description}</span>
          </span>
        </button>
      ))}
      <div className="flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3.5">
        <span>
          <span className="block font-medium text-ink">Privacy mode</span>
          <span className="block text-sm text-muted">Never keep audio recordings.</span>
        </span>
        <Toggle checked={preferences.privacy_mode} onChange={(v) => savePreferences({ privacy_mode: v })} label="Privacy mode" />
      </div>
    </div>
  );
}
