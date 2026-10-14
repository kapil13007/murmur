// File: src/Insights/components/TopApps.jsx
import { AppWindow } from 'lucide-react';
import { formatNumber, relativeTime } from '../../utils/formatter';
import EmptyState from '../../components/ui/EmptyState';

const CATEGORY = { personal: 'Personal', work: 'Work', email: 'Email', other: 'Other' };

export default function TopApps({ apps }) {
  if (!apps.length) {
    return <EmptyState icon={AppWindow} title="No apps yet" body="Try Flow in Slack, Gmail, Notion or any text box." />;
  }
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-raised">
      {apps.map((app, i) => (
        <div key={app.app_name} className="flex items-center gap-4 px-5 py-3.5">
          <span className="w-5 text-sm tabular-nums text-faint">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate font-medium text-ink">{app.app_name}</p>
              <p className="shrink-0 text-sm text-muted">
                <span className="font-semibold text-ink">{formatNumber(app.words)}</span> words
              </p>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                <div className="h-full rounded-full bg-dawn-700" style={{ width: `${Math.max(2, app.share)}%` }} />
              </div>
              <span className="w-28 shrink-0 text-right text-xs text-faint">
                {CATEGORY[app.app_category] || 'Other'} · {relativeTime(app.last_used_at)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
