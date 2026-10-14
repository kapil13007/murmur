// File: src/Notes/NoteEditor.jsx
// Full note editor: autosave, dictate at the cursor, AI transforms, versions.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, Copy, History, Pin, Trash2, Wand2 } from 'lucide-react';
import clsx from 'clsx';
import {
  deleteNote,
  errorMessage,
  getNote,
  getTransforms,
  transformNote,
  updateNote,
} from '../api/apiClient';
import { relativeTime } from '../utils/formatter';
import ConfirmModal from '../components/ui/ConfirmModal';
import Menu from '../components/ui/Menu';
import Modal from '../components/ui/Modal';
import { PageSpinner } from '../components/ui/Spinner';
import DictateButton from '../components/DictateButton';
import VersionsDrawer from './components/VersionsDrawer';

export default function NoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [transforms, setTransforms] = useState([]);
  const [transforming, setTransforming] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);
  const saveTimer = useRef(null);

  const hydrate = (n) => {
    setNote(n);
    setTitle(n.title);
    setContent(n.content);
  };

  useEffect(() => {
    getNote(id)
      .then(hydrate)
      .catch((err) => {
        toast.error(errorMessage(err));
        navigate('/notes');
      });
    getTransforms()
      .then((list) => setTransforms(list.filter((t) => t.is_enabled)))
      .catch(() => {});
  }, [id, navigate]);

  const save = useCallback(
    async (changes) => {
      setSaving(true);
      try {
        setNote(await updateNote(id, changes));
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setSaving(false);
      }
    },
    [id],
  );

  // Unsaved edits are derived, not stored: the note on the server vs the fields.
  const dirty = Boolean(note) && (title !== note.title || content !== note.content);

  // Debounced autosave while typing.
  useEffect(() => {
    if (!dirty) return undefined;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save({ title, content }), 800);
    return () => clearTimeout(saveTimer.current);
  }, [dirty, title, content, save]);

  // Auto-grow the editor.
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [content]);

  if (!note) return <PageSpinner />;

  const insertAtCursor = (text) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : content.length;
    const end = el ? el.selectionEnd : content.length;
    const before = content.slice(0, start);
    const spacer = before && !/\s$/.test(before) ? ' ' : '';
    setContent(before + spacer + text + content.slice(end));
  };

  const runTransform = async (payload) => {
    clearTimeout(saveTimer.current);
    if (title !== note.title || content !== note.content) await save({ title, content });
    setTransforming(true);
    const tid = toast.loading('Transforming note…');
    try {
      const res = await transformNote(id, payload);
      if (res.run.status === 'no_changes') toast('No changes made', { id: tid });
      else toast.success(`Transformed with ${res.run.transform_name || 'your instruction'} · previous text saved in versions`, { id: tid });
      hydrate(res.note);
    } catch (err) {
      toast.error(errorMessage(err), { id: tid });
    } finally {
      setTransforming(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/notes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> Scratchpad
        </Link>
        <div className="flex items-center gap-1.5">
          <span className="mr-2 text-xs text-faint">
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : `Saved · ${relativeTime(note.updated_at)}`}
          </span>
          <DictateButton onText={insertAtCursor} />
          <Menu
            width="w-64"
            trigger={
              <button className="btn-secondary px-3" disabled={transforming || !content.trim()}>
                <Wand2 size={15} /> Transform
              </button>
            }
            items={[
              { heading: 'Transforms' },
              ...transforms.map((t) => ({ label: t.name, onClick: () => runTransform({ transform_id: t.id }) })),
              { divider: true },
              { label: 'Custom instruction…', icon: Wand2, onClick: () => setCustomOpen(true) },
            ]}
          />
          <button className="btn-ghost px-2.5" onClick={() => setVersionsOpen(true)} title="Version history">
            <History size={16} />
          </button>
          <button
            className={clsx('btn-ghost px-2.5', note.is_pinned && 'text-glow-400')}
            onClick={() => save({ is_pinned: !note.is_pinned })}
            title={note.is_pinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={16} fill={note.is_pinned ? 'currentColor' : 'none'} />
          </button>
          <button className="btn-ghost px-2.5" onClick={copy} title="Copy note">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button className="btn-ghost px-2.5 hover:text-flare-500" onClick={() => setConfirmDelete(true)} title="Delete note">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        className="w-full bg-transparent font-display text-[36px] leading-tight text-ink placeholder:text-faint focus:outline-none"
      />
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing, or press Dictate and speak…"
        className={clsx(
          'mt-4 min-h-[50vh] w-full resize-none overflow-hidden bg-transparent text-[16px] leading-[1.75] text-ink placeholder:text-faint focus:outline-none',
          transforming && 'opacity-50',
        )}
      />

      <Modal isOpen={customOpen} onClose={() => setCustomOpen(false)} title="Transform with an instruction" subtitle="Tell Flow how to rewrite this note.">
        <textarea
          className="input min-h-[90px]"
          placeholder="e.g. Turn this into a short email to my team"
          value={customInstruction}
          onChange={(e) => setCustomInstruction(e.target.value)}
          autoFocus
        />
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setCustomOpen(false)}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!customInstruction.trim()}
            onClick={() => {
              setCustomOpen(false);
              runTransform({ instruction: customInstruction.trim() });
            }}
          >
            Transform
          </button>
        </div>
      </Modal>
      {versionsOpen && <VersionsDrawer noteId={id} onClose={() => setVersionsOpen(false)} onRestored={hydrate} />}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteNote(id);
          toast.success('Note deleted');
          navigate('/notes');
        }}
        title="Are you sure you want to delete this note?"
        message="Once deleted it cannot be recovered"
      />
    </div>
  );
}
