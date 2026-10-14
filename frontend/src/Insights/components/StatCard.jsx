// File: src/Insights/components/StatCard.jsx
import clsx from 'clsx';

const TONES = {
  dawn: 'from-dawn-300 to-dawn-100 dark:from-dawn-900 dark:to-vast-900',
  fathom: 'from-fathom-100 to-fathom-50 dark:from-fathom-950 dark:to-vast-900',
  glow: 'from-glow-100 to-glow-50 dark:from-vast-800 dark:to-vast-900',
  signal: 'from-signal-200 to-signal-100 dark:from-vast-800 dark:to-vast-900',
};

export default function StatCard({ label, value, unit, hint, tone = 'dawn' }) {
  return (
    <div className={clsx('rounded-2xl border border-line bg-gradient-to-br p-5', TONES[tone])}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-display text-[40px] leading-none text-ink">
        {value}
        {unit && <span className="ml-1.5 font-sans text-sm font-medium text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}
