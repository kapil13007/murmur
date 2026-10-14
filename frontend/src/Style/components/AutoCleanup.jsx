// File: src/Style/components/AutoCleanup.jsx
// Wispr's cleanup levels: None / Light / Medium / High, plus formatting toggles.
import clsx from 'clsx';
import { useApp } from '../../context/AppContext';
import Toggle from '../../components/ui/Toggle';

const LEVELS = {
  none: { label: 'None', description: 'Transcribes exactly what you said, including mistakes' },
  light: { label: 'Light', description: 'Cleans up filler words and grammar' },
  medium: { label: 'Medium', description: 'Edits for clarity and conciseness' },
  high: { label: 'High', description: 'Rewrites for brevity and polish' },
};

export default function AutoCleanup({ examples }) {
  const { preferences, savePreferences } = useApp();
  if (!preferences) return null;
  const current = preferences.ai_formatting ? preferences.auto_cleanup_level : 'none';

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-muted">Choose how much Flow edits each dictation for clarity and correctness.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {examples.map(({ level, example }) => (
          <button
            key={level}
            onClick={() => savePreferences({ auto_cleanup_level: level, ai_formatting: level !== 'none' ? true : preferences.ai_formatting })}
            aria-pressed={current === level}
            className={clsx(
              'rounded-2xl border p-4 text-left transition',
              current === level ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-vast-300',
            )}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-ink">{LEVELS[level].label}</p>
              <span className={clsx('h-4 w-4 rounded-full border-2', current === level ? 'border-ink bg-ink' : 'border-vast-300')} />
            </div>
            <p className="mt-0.5 text-xs text-muted">{LEVELS[level].description}</p>
            <p className="mt-3 rounded-xl bg-subtle p-3 text-[13px] leading-snug text-ink">{example}</p>
          </button>
        ))}
      </div>

      <div className="divide-y divide-line rounded-2xl border border-line">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-ink">AI formatting</p>
            <p className="text-xs text-muted">Turn off to paste the raw transcript with no cleanup at all.</p>
          </div>
          <Toggle checked={preferences.ai_formatting} onChange={(v) => savePreferences({ ai_formatting: v })} label="AI formatting" />
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-ink">Smart Formatting</p>
            <p className="text-xs text-muted">Lists, email layout and spoken commands like &ldquo;new line&rdquo; or &ldquo;question mark&rdquo;.</p>
          </div>
          <Toggle checked={preferences.smart_formatting} onChange={(v) => savePreferences({ smart_formatting: v })} label="Smart formatting" />
        </div>
      </div>
    </div>
  );
}
