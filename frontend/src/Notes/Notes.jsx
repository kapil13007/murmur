// File: src/Notes/Notes.jsx
// Scratchpad: quick capture + all notes (pinned first).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LayoutGrid, List, NotebookPen, Pin } from 'lucide-react';
import clsx from 'clsx';
import { createNote, errorMessage, getNotes } from '../api/apiClient';
import { useApp } from '../context/AppContext';
import { useDebounce } from '../hooks/useDebounce';
import { onServerEvent } from '../hooks/useServerEvents';
import { relativeTime } from '../utils/formatter';
import EmptyState from '../components/ui/EmptyState';
import SearchInput from '../components/ui/SearchInput';
import Spinner from '../components/ui/Spinner';
import DictateButton from '../components/DictateButton';

export default function Notes() {
  const navigate = useNavigate();
  const { preferences, savePreferences } = useApp();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const debounced = useDebounce(search, 250);
  const view = preferences?.notes_view || 'grid';

  const load = useCallback(() => {
    getNotes({ search: debounced || undefined })
      .then(setNotes)
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [debounced]);

  useEffect(() => load(), [load]);
  useEffect(() => onServerEvent('notes.changed', load), [load]);

  const saveDraft = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await createNote({ content: draft.trim(), source: 'typed' });
      setDraft('');
      toast.success('Note saved');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Scratchpad</h1>
      <p className="mt-1 text-sm text-muted">For quick thoughts you want to come back to.</p>

      <div className="mt-6 rounded-2xl border border-line bg-raised p-4 focus-within:border-dawn-600">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && saveDraft()}
          placeholder="Take a quick note with your voice or keyboard…"
          className="min-h-[72px] w-full resize-none bg-transparent text-[15px] text-ink placeholder:text-faint focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <DictateButton onText={(text) => setDraft((d) => (d ? `${d.trimEnd()} ${text}` : text))} />
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-faint sm:inline">Ctrl + Enter to save</span>
            <button className="btn-primary" onClick={saveDraft} disabled={saving || !draft.trim()}>
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <p className="section-label">Recents</p>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search your notes" className="w-60" />
          <div className="flex rounded-xl border border-line p-0.5">
            {[
              ['grid', LayoutGrid],
              ['list', List],
            ].map(([id, Icon]) => (
              <button
                key={id}
                onClick={() => savePreferences({ notes_view: id })}
                className={clsx('rounded-lg p-1.5', view === id ? 'bg-subtle text-ink' : 'text-faint hover:text-ink')}
                aria-label={`${id} view`}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="py-10 text-center">
            <Spinner />
          </div>
        ) : !notes.length ? (
          <EmptyState icon={NotebookPen} title="No notes found" body={search ? 'Try a different search.' : 'Your quick notes will show up here.'} />
        ) : (
          <div className={view === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'divide-y divide-line rounded-2xl border border-line'}>
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => navigate(`/notes/${note.id}`)}
                className={clsx(
                  'group relative text-left transition',
                  view === 'grid' ? 'flex h-40 flex-col rounded-2xl border border-line bg-raised p-4 hover:border-vast-300 hover:shadow-panel' : 'flex w-full items-center gap-4 px-5 py-3.5 hover:bg-subtle/60',
                )}
              >
                <div className={clsx('min-w-0', view === 'grid' ? 'flex-1 overflow-hidden' : 'flex-1')}>
                  {note.title ? (
                    <>
                      <p className="truncate font-semibold text-ink">{note.title}</p>
                      <p className={clsx('mt-1 text-sm text-muted', view === 'grid' ? 'line-clamp-4' : 'truncate')}>{note.content_preview}</p>
                    </>
                  ) : (
                    <p className={clsx('text-[15px] text-ink', view === 'grid' ? 'line-clamp-5' : 'truncate')}>{note.content_preview || 'Empty note'}</p>
                  )}
                </div>
                <div className={clsx('flex items-center gap-2 text-xs text-faint', view === 'grid' && 'mt-2')}>
                  {note.is_pinned && <Pin size={12} className="text-glow-400" fill="currentColor" />}
                  {relativeTime(note.updated_at)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
