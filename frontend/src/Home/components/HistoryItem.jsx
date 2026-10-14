// File: src/Home/components/HistoryItem.jsx
// One dictation row: time | text, with hover actions (copy, play audio, menu).
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  Flag,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
} from 'lucide-react';
import clsx from 'clsx';
import {
  deleteTranscript,
  errorMessage,
  getTranscriptAudio,
  retryTranscript,
  updateTranscript,
} from '../../api/apiClient';
import { formatTime } from '../../utils/formatter';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Menu from '../../components/ui/Menu';
import EditTranscriptModal from './EditTranscriptModal';
import FeedbackModal from './FeedbackModal';

const STATUS_TEXT = {
  no_audio: 'Audio is silent.',
  empty: "Flow couldn't make out any words.",
  error: 'This transcription failed.',
  dismissed: 'The transcription was dismissed.',
};

export default function HistoryItem({ transcript: t, onChange, onRemove }) {
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const ok = t.status === 'success';
  const text = ok ? t.text : STATUS_TEXT[t.status] || t.text;

  const copy = async () => {
    await navigator.clipboard.writeText(t.text);
    setCopied(true);
    toast.success('Transcript copied');
    setTimeout(() => setCopied(false), 1500);
  };

  const togglePlay = async () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    try {
      if (!audioRef.current) {
        const blob = await getTranscriptAudio(t.id);
        audioRef.current = new Audio(URL.createObjectURL(blob));
        audioRef.current.onended = () => setPlaying(false);
      }
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      toast.error('Audio is no longer available (recordings are kept for 14 days)');
    }
  };

  const patch = async (changes, message) => {
    try {
      const updated = await updateTranscript(t.id, changes);
      onChange(updated);
      if (message) toast.success(message);
      return updated;
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    }
  };

  const retry = async () => {
    setBusy(true);
    const tid = toast.loading('Retrying transcript…');
    try {
      onChange(await retryTranscript(t.id));
      toast.success('Transcript updated', { id: tid });
    } catch (err) {
      toast.error(errorMessage(err), { id: tid });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await deleteTranscript(t.id);
    onRemove(t.id);
    toast.success('Transcript deleted');
  };

  const canUndoAi = ok && !t.edited_text && t.asr_text && t.formatted_text && t.asr_text !== t.formatted_text;

  return (
    <div className={clsx('group relative flex gap-5 px-5 py-4 transition hover:bg-subtle', busy && 'opacity-60')}>
      <span className="w-[68px] shrink-0 pt-0.5 text-sm tabular-nums text-faint">{formatTime(t.created_at)}</span>
      <p className={clsx('min-w-0 flex-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed', ok ? 'text-ink' : 'italic text-faint')}>{text}</p>
      {/* Floats over the row's right edge so the text can use the full width. */}
      <div
        className={clsx(
          'absolute right-3 top-2.5 flex items-start gap-0.5 rounded-xl bg-subtle pl-2 shadow-[-12px_0_12px_rgb(var(--subtle))] group-hover:visible',
          menuOpen ? 'visible' : 'invisible focus-within:visible',
        )}
      >
        <span className="mr-1.5 flex h-[30px] items-center gap-1.5 text-xs text-faint">
          {t.app_name && <span className="max-w-[120px] truncate rounded-md bg-panel px-1.5 py-0.5 text-muted">{t.app_name}</span>}
          {ok && <span className="whitespace-nowrap">{t.num_words} words</span>}
          {t.edited_text && <span>· edited</span>}
          {t.has_reverted_ai && <span>· original</span>}
          {t.mode === 'command' && <span>· command</span>}
        </span>
        {ok && (
          <button onClick={copy} className="rounded-lg p-1.5 text-muted hover:bg-panel hover:text-ink" title="Copy transcript">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        )}
        {t.has_audio && (
          <button onClick={togglePlay} className="rounded-lg p-1.5 text-muted hover:bg-panel hover:text-ink" title={playing ? 'Pause audio' : 'Play audio'}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        )}
        <Menu
          onOpenChange={setMenuOpen}
          trigger={
            <button className="rounded-lg p-1.5 text-muted hover:bg-panel hover:text-ink" title="More options" aria-label="More options">
              <MoreHorizontal size={16} />
            </button>
          }
          items={[
            ok && { label: 'Edit transcript', icon: Pencil, onClick: () => setEditing(true) },
            canUndoAi && !t.has_reverted_ai && { label: 'Undo AI edit', icon: Undo2, onClick: () => patch({ has_reverted_ai: true }, 'Showing your original words') },
            t.has_reverted_ai && { label: 'Redo AI edit', icon: RotateCw, onClick: () => patch({ has_reverted_ai: false }, 'AI formatting restored') },
            t.has_audio && { label: 'Retry transcript', icon: RotateCcw, onClick: retry },
            t.is_archived
              ? { label: 'Unarchive', icon: ArchiveRestore, onClick: () => patch({ is_archived: false }, 'Transcript unarchived') }
              : { label: 'Archive', icon: Archive, onClick: () => patch({ is_archived: true }, 'Transcript archived') },
            ok && { label: 'Send feedback', icon: Flag, onClick: () => setReporting(true) },
            { divider: true },
            { label: 'Delete transcript', icon: Trash2, danger: true, onClick: () => setConfirmDelete(true) },
          ]}
        />
      </div>

      {editing && (
        <EditTranscriptModal
          transcript={t}
          onClose={() => setEditing(false)}
          onSave={async (edited) => {
            const updated = await patch({ edited_text: edited });
            if (updated?.learned_words?.length) {
              toast.success(`Flow learned ${updated.learned_words.map((w) => `"${w.replacement || w.phrase}"`).join(', ')}`);
            } else if (updated) toast.success('Transcript updated');
            setEditing(false);
          }}
        />
      )}
      {reporting && <FeedbackModal transcript={t} onClose={() => setReporting(false)} onSubmit={(feedback) => patch({ feedback }, 'Report sent!')} />}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Are you sure you want to delete this transcript?"
        message="Once deleted it cannot be recovered"
      />
    </div>
  );
}
