// File: src/Home/components/UsageBar.jsx
// Flow Basic weekly allowance ("1,250 words left this week").
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { formatDate, formatNumber } from '../../utils/formatter';

export default function UsageBar({ usage }) {
  const navigate = useNavigate();
  const location = useLocation();
  const pct = Math.min(100, (usage.words_used / usage.limit) * 100);
  return (
    <div className="card flex items-center gap-5 px-5 py-4">
      <div className="flex-1">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-ink">{formatNumber(usage.remaining)} words left this week</span>
          <span className="text-xs text-muted">Resets {formatDate(usage.resets_at, { weekday: 'long', hour: 'numeric' })}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-subtle">
          <div className={clsx('h-full rounded-full', pct >= 90 ? 'bg-flare-400' : 'bg-fathom-600')} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <button className="btn-primary" onClick={() => navigate('/settings/plans', { state: { background: location } })}>
        Upgrade
      </button>
    </div>
  );
}
