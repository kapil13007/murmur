// File: src/Notes/components/VersionsDrawer.jsx
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RotateCcw, X } from 'lucide-react';
import clsx from 'clsx';
import { errorMessage, getNoteVersions, restoreNoteVersion } from '../../api/apiClient';
import { formatDate, formatTime } from '../../utils/formatter';
import Spinner from '../../components/ui/Spinner';

const SOURCE_LABEL = { snapshot: 'Autosave', transform: 'Before transform', restore: 'Before restore' };

// Mounted only while open, so it always fetches a fresh version list.
export default function VersionsDrawer({ noteId, onClose, onRestored }) {
  const [versions, setVersions] = useState(null);
  const [active, setActive] = useState(null);

  useEffect(() => {
    getNoteVersions(noteId)
      .then((list) => {
        setVersions(list);
        setActive(list[0] || null);
      })
      .catch((err) => toast.error(errorMessage(err)));
  }, [noteId]);

  const restore = async () => {
    try {
      onRestored(await restoreNoteVersion(noteId, active.id));
      toast.success('Version restored');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-vast-950/30 animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="flex h-full w-full max-w-2xl animate-pop-in bg-panel shadow-pop">
        <div className="w-56 shrink-0 overflow-y-auto border-r border-line p-3">
          <p className="section-label px-2 pb-2 pt-1">Versions</p>
          {!versions ? (
            <Spinner className="p-2" />
          ) : !versions.length ? (
            <p className="px-2 text-sm text-muted">No versions yet</p>
          ) : (
            versions.map((v) => (
              <button
                key={v.id}
                onClick={() => setActive(v)}
                className={clsx('mb-1 w-full rounded-xl px-3 py-2 text-left', active?.id === v.id ? 'bg-subtle' : 'hover:bg-subtle/60')}
              >
                <p className="text-sm font-medium text-ink">{formatDate(v.created_at, { month: 'short', day: 'numeric' })}, {formatTime(v.created_at)}</p>
                <p className="text-xs text-muted">{SOURCE_LABEL[v.source]}</p>
              </button>
            ))
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="truncate text-sm font-semibold text-ink">{active?.transform_prompt ? `Before: ${active.transform_prompt}` : active ? active.title || 'Untitled' : ''}</p>
            <div className="flex items-center gap-2">
              {active && (
                <button className="btn-primary px-3 py-1.5 text-xs" onClick={restore}>
                  <RotateCcw size={13} /> Restore
                </button>
              )}
              <button onClick={onClose} className="rounded-lg p-1 text-faint hover:bg-subtle hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto whitespace-pre-wrap px-6 py-5 text-[15px] leading-relaxed text-ink">{active?.content}</div>
        </div>
      </aside>
    </div>
  );
}
