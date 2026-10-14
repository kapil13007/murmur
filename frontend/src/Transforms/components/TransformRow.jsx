// File: src/Transforms/components/TransformRow.jsx
import { Pencil, Trash2 } from 'lucide-react';
import Toggle from '../../components/ui/Toggle';

export default function TransformRow({ transform: t, onToggle, onEdit, onDelete }) {
  return (
    <div className="group flex items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium text-ink">
          {t.name}
          {t.is_builtin && <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold text-muted">Built-in</span>}
        </p>
        <p className="truncate text-sm text-muted">{t.instruction}</p>
      </div>
      {!t.is_builtin && (
        <div className="flex items-center opacity-0 transition group-hover:opacity-100">
          <button onClick={onEdit} className="rounded-lg p-1.5 text-faint hover:bg-panel hover:text-ink" title="Edit">
            <Pencil size={16} />
          </button>
          <button onClick={onDelete} className="rounded-lg p-1.5 text-faint hover:bg-panel hover:text-flare-500" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      )}
      <Toggle checked={t.is_enabled} onChange={onToggle} label={`Enable ${t.name}`} />
    </div>
  );
}
