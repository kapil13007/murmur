// File: src/Transforms/components/RunHistory.jsx
import { History } from 'lucide-react';
import clsx from 'clsx';
import { relativeTime } from '../../utils/formatter';
import EmptyState from '../../components/ui/EmptyState';

const STATUS = {
  success: 'text-fathom-700 dark:text-fathom-300',
  no_changes: 'text-muted',
  error: 'text-flare-500',
  unsupported: 'text-glow-400',
};

export default function RunHistory({ kind, runs }) {
  if (!runs.length) {
    return (
      <div className="mt-4">
        <EmptyState
          icon={History}
          title="Nothing here yet"
          body={kind === 'commands' ? 'Select text in any app, hold the Command Mode shortcut and say what to change.' : 'Transforms you run will show up here.'}
        />
      </div>
    );
  }
  return (
    <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-raised">
      {runs.slice(0, 30).map((r) => (
        <div key={r.id} className="px-5 py-3.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <p className="font-semibold text-ink">
              {kind === 'commands' ? `“${r.instruction}”` : r.transform_name || 'Custom instruction'}
              {r.app_name && <span className="ml-2 font-normal text-faint">in {r.app_name}</span>}
            </p>
            <p className="shrink-0 text-faint">
              <span className={clsx('mr-2 font-medium', STATUS[r.status])}>{r.status.replace('_', ' ')}</span>
              {relativeTime(r.created_at)}
            </p>
          </div>
          {(r.input_text || r.selected_text) && <p className="mt-1.5 line-clamp-1 text-sm text-faint line-through decoration-vast-200">{r.input_text || r.selected_text}</p>}
          {r.output_text && <p className="mt-0.5 line-clamp-2 text-sm text-ink">{r.output_text}</p>}
        </div>
      ))}
    </div>
  );
}
