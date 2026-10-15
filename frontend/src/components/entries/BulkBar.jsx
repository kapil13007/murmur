// File: src/components/entries/BulkBar.jsx
import { Trash2, X } from 'lucide-react';

export default function BulkBar({ count, noun, onClear, onDelete }) {
  if (!count) return null;
  return (
    <div role="toolbar" aria-label="Bulk actions" className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 animate-pop-in items-center gap-2 rounded-2xl bg-vast-950 px-3 py-2 text-sand-50 shadow-pop">
      <span className="px-2 text-sm font-medium">
        {count} {noun}
        {count === 1 ? '' : 's'} selected
      </span>
      <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-flare-300 hover:bg-vast-800">
        <Trash2 size={14} /> Delete {count}
      </button>
      <button onClick={onClear} className="rounded-xl p-1.5 text-vast-300 hover:bg-vast-800" aria-label="Clear selection">
        <X size={15} />
      </button>
    </div>
  );
}
