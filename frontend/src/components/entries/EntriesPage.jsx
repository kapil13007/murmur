// File: src/components/entries/EntriesPage.jsx
// Shared screen for Dictionary and Snippets (both are views over the same
// `dictionary_entries` table on the backend).
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDownUp, Plus, Upload } from 'lucide-react';
import { errorMessage } from '../../api/apiClient';
import { useDebounce } from '../../hooks/useDebounce';
import { onServerEvent } from '../../hooks/useServerEvents';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import Menu from '../ui/Menu';
import SearchInput from '../ui/SearchInput';
import Spinner from '../ui/Spinner';
import BulkBar from './BulkBar';
import EntryRow from './EntryRow';
import ImportModal from './ImportModal';

const SORTS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'alphabetical', label: 'Alphabetical (A-Z)' },
  { id: 'starred', label: 'Starred first' },
];

/**
 * config: { api, title, noun, banner, emptyIcon, EntryModal, importHelp }
 */
export default function EntriesPage({ config }) {
  const { api, title, noun, banner, emptyIcon, EntryModal, importHelp } = config;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [modal, setModal] = useState(null); // { mode: 'add' } | { mode: 'edit', entry }
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState(null); // ids to delete
  const debouncedSearch = useDebounce(search, 250);

  const load = useCallback(
    () =>
      api
        .list({ sort, search: debouncedSearch || undefined })
        .then((res) => setItems(res.items))
        .catch((err) => toast.error(errorMessage(err)))
        .finally(() => setLoading(false)),
    [api, sort, debouncedSearch],
  );

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => onServerEvent('dictionary.changed', () => load()), [load]);

  // Changing the search clears any bulk selection.
  const changeSearch = (next) => {
    setSearch(next);
    setSelected(new Set());
  };

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async (payload) => {
    if (modal.mode === 'add') {
      await api.create(payload);
      toast.success(`Added ${noun} "${payload.phrase}"`);
    } else {
      const res = await api.update(modal.entry.id, payload);
      toast.success(res.unchanged ? 'No changes made' : `Updated ${noun} "${res.phrase}"`);
    }
    setModal(null);
    load();
  };

  const toggleStar = async (entry) => {
    setItems((prev) => prev.map((e) => (e.id === entry.id ? { ...e, is_starred: !e.is_starred } : e)));
    try {
      await api.update(entry.id, { is_starred: !entry.is_starred });
    } catch (err) {
      toast.error(errorMessage(err));
      load();
    }
  };

  const remove = async (ids) => {
    const res = await api.bulkDelete(ids);
    toast.success(`Deleted ${res.deleted} ${noun}${res.deleted === 1 ? '' : 's'}`);
    if (res.failed) toast.error(`Failed to delete ${res.failed} ${noun}${res.failed === 1 ? '' : 's'}`);
    setSelected(new Set());
    load();
  };

  return (
    <div>
      <header className="flex items-center justify-between gap-4">
        <h1 className="page-title">{title}</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setImporting(true)}>
            <Upload size={15} /> Import
          </button>
          <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>
            <Plus size={16} /> Add new
          </button>
        </div>
      </header>

      {banner}

      <div className="mt-8 flex flex-wrap items-end justify-end gap-3">
        <div className="flex items-center gap-2 pb-1">
          <SearchInput value={search} onChange={changeSearch} placeholder={`Search your ${noun === 'word' ? 'vocabulary' : 'snippets'}`} className="w-60" />
          <Menu
            trigger={
              <button className="btn-secondary px-3" title="Sort by">
                <ArrowDownUp size={15} />
              </button>
            }
            items={[
              { heading: 'Sort by' },
              ...SORTS.map((s) => ({
                label: s.label,
                active: sort === s.id,
                onClick: () => setSort(s.id),
              })),
            ]}
          />
        </div>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="py-10 text-center">
            <Spinner />
          </div>
        ) : !items.length ? (
          <EmptyState
            icon={emptyIcon}
            title={search ? 'No results found' : `No ${noun}s yet`}
            body={search ? `No ${noun}s match your search.` : `Add your first ${noun} to get started.`}
            action={
              !search ? (
                <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>
                  <Plus size={16} /> Add {noun}
                </button>
              ) : null
            }
          />
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-raised">
            {items.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                noun={noun}
                selected={selected.has(entry.id)}
                selectionMode={selected.size > 0}
                onSelect={() => toggleSelect(entry.id)}
                onStar={() => toggleStar(entry)}
                onEdit={() => setModal({ mode: 'edit', entry })}
                onDelete={() => setConfirm([entry.id])}
              />
            ))}
          </div>
        )}
        {items.length > 0 && <p className="mt-3 text-right text-xs text-faint">{items.length} {noun}{items.length === 1 ? '' : 's'}</p>}
      </div>

      <BulkBar count={selected.size} noun={noun} onClear={() => setSelected(new Set())} onDelete={() => setConfirm([...selected])} />

      {modal && <EntryModal isOpen mode={modal.mode} entry={modal.entry} onClose={() => setModal(null)} onSave={save} />}
      <ImportModal
        isOpen={importing}
        noun={noun}
        help={importHelp}
        onClose={() => setImporting(false)}
        onImport={async (text) => {
          const res = await api.importText(text);
          toast.success(`Imported ${res.created} ${noun}${res.created === 1 ? '' : 's'}${res.skipped ? `, skipped ${res.skipped}` : ''}`);
          load();
          return res;
        }}
      />
      <ConfirmModal
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove(confirm)}
        title={confirm?.length > 1 ? `Delete ${confirm.length} ${noun}s?` : `Delete this ${noun}?`}
        message={`The selected ${noun}${confirm?.length > 1 ? 's' : ''} will be deleted permanently.`}
      />
    </div>
  );
}
