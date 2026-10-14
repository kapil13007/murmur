// File: src/Home/components/HistorySection.jsx
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Archive, History } from 'lucide-react';
import clsx from 'clsx';
import { errorMessage, getHistory } from '../../api/apiClient';
import { useDebounce } from '../../hooks/useDebounce';
import { onServerEvent } from '../../hooks/useServerEvents';
import { groupByDay } from '../../utils/formatter';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Spinner from '../../components/ui/Spinner';
import HistoryItem from './HistoryItem';

export default function HistorySection() {
  // One loaded page of results, tagged with the query it was loaded for.
  const [page, setPage] = useState({ key: null, items: [], hasMore: false, nextBefore: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const queryKey = `${archived}|${debouncedSearch}`;
  // Loading is derived: the loaded page belongs to a different query.
  const loading = page.key !== queryKey;
  const { items, hasMore, nextBefore } = page;

  const fetchPage = useCallback(
    (before) => getHistory({ search: debouncedSearch || undefined, archived, before: before || undefined, limit: 30 }),
    [debouncedSearch, archived],
  );

  const reload = useCallback(
    () =>
      fetchPage()
        .then((res) => setPage({ key: queryKey, items: res.items, hasMore: res.has_more, nextBefore: res.next_before }))
        .catch((err) => {
          toast.error(errorMessage(err));
          setPage((p) => ({ ...p, key: queryKey }));
        }),
    [fetchPage, queryKey],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetchPage(nextBefore);
      setPage((p) => ({ ...p, items: [...p.items, ...res.items], hasMore: res.has_more, nextBefore: res.next_before }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const setItems = useCallback((update) => setPage((p) => ({ ...p, items: update(p.items) })), []);

  // Dictations from the desktop app (or another tab) appear instantly.
  useEffect(() => {
    const offs = [
      onServerEvent('transcript.created', (t) => {
        if (!archived && !debouncedSearch) setItems((prev) => (prev.some((p) => p.id === t.id) ? prev : [t, ...prev]));
      }),
      onServerEvent('transcript.updated', (t) =>
        setItems((prev) => prev.map((p) => (p.id === t.id ? { ...p, ...t } : p)).filter((p) => p.is_archived === archived)),
      ),
      onServerEvent('transcript.deleted', ({ id }) => setItems((prev) => prev.filter((p) => p.id !== id))),
      onServerEvent('transcript.cleared', () => reload()),
    ];
    return () => offs.forEach((off) => off());
  }, [archived, debouncedSearch, reload, setItems]);

  const replace = (t) => setItems((prev) => prev.map((p) => (p.id === t.id ? { ...p, ...t } : p)).filter((p) => p.is_archived === archived));
  const remove = (id) => setItems((prev) => prev.filter((p) => p.id !== id));
  const groups = groupByDay(items);

  return (
    <section className="mt-10" aria-label="Dictation history">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">History</h2>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search past transcripts" className="w-64" />
          <button
            onClick={() => setArchived((a) => !a)}
            className={clsx('btn-secondary px-3', archived && 'bg-subtle')}
            title={archived ? 'Show recent transcripts' : 'Show archived transcripts'}
          >
            <Archive size={15} /> {archived ? 'Archived' : 'Archive'}
          </button>
        </div>
      </div>

      {loading && !items.length ? (
        <div className="py-10 text-center">
          <Spinner label="Loading history…" />
        </div>
      ) : !items.length ? (
        <EmptyState
          icon={History}
          title={search ? 'No results found' : archived ? 'Nothing archived' : 'No dictations yet'}
          body={
            search
              ? 'No transcripts match your search.'
              : 'Once you dictate across different apps, your entire dictation history will appear here.'
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="section-label mb-2 px-1">{group.label}</p>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-raised">
                {group.items.map((t) => (
                  <HistoryItem key={t.id} transcript={t} onChange={replace} onRemove={remove} />
                ))}
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="text-center">
              <button className="btn-secondary" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
