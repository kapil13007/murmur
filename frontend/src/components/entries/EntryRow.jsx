// File: src/components/entries/EntryRow.jsx
import { ArrowRight, Pencil, Sparkles, Star, Trash2 } from 'lucide-react';
import clsx from 'clsx';

export default function EntryRow({ entry, noun, selected, selectionMode, onSelect, onStar, onEdit, onDelete }) {
  const isSnippet = noun === 'snippet';
  return (
    <div className={clsx('group flex items-center gap-4 px-5 py-3.5 transition hover:bg-subtle/60', selected && 'bg-dawn-100 dark:bg-vast-800')}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        aria-label={`Select ${entry.phrase}`}
        className={clsx('h-4 w-4 shrink-0 accent-vast-950 transition', selectionMode || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
      />
      <div className="min-w-0 flex-1">
        {isSnippet ? (
          <>
            <p className="font-medium text-ink">&ldquo;{entry.phrase}&rdquo;</p>
            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-muted">{entry.replacement}</p>
          </>
        ) : entry.replacement ? (
          <p className="flex flex-wrap items-center gap-2 text-ink">
            <span className="text-muted line-through decoration-flare-300">{entry.phrase}</span>
            <ArrowRight size={14} className="text-faint" />
            <span className="font-medium">{entry.replacement}</span>
          </p>
        ) : (
          <p className="font-medium text-ink">{entry.phrase}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {entry.source === 'auto_learned' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-fathom-50 px-2 py-0.5 text-[11px] font-semibold text-fathom-900 dark:bg-fathom-950 dark:text-fathom-100" title="Learned from your edits">
            <Sparkles size={11} /> Auto-added
          </span>
        )}
        {entry.frequency_used > 0 && <span className="text-xs text-faint">Used {entry.frequency_used}×</span>}
        <button onClick={onStar} className={clsx('rounded-lg p-1.5 transition hover:bg-panel', entry.is_starred ? 'text-glow-300' : 'text-faint opacity-0 group-hover:opacity-100')} title={entry.is_starred ? 'Unstar' : 'Star'}>
          <Star size={16} fill={entry.is_starred ? 'currentColor' : 'none'} />
        </button>
        <div className="flex items-center opacity-0 transition group-hover:opacity-100">
          <button onClick={onEdit} className="rounded-lg p-1.5 text-faint hover:bg-panel hover:text-ink" title="Edit">
            <Pencil size={16} />
          </button>
          <button onClick={onDelete} className="rounded-lg p-1.5 text-faint hover:bg-panel hover:text-flare-500" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
