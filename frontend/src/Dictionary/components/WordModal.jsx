// File: src/Dictionary/components/WordModal.jsx
// "Add to vocabulary" / "Edit word" (with "Correct a misspelling").
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { errorMessage } from '../../api/apiClient';
import Modal from '../../components/ui/Modal';
import Toggle from '../../components/ui/Toggle';
import ShareToggle from '../../components/entries/ShareToggle';

export default function WordModal({ isOpen, mode, entry, hasTeam, onClose, onSave }) {
  const [phrase, setPhrase] = useState(entry?.phrase || '');
  const [correcting, setCorrecting] = useState(Boolean(entry?.replacement));
  const [replacement, setReplacement] = useState(entry?.replacement || '');
  const [share, setShare] = useState(Boolean(entry?.is_shared));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!phrase.trim()) return setError('Word cannot be empty');
    if (correcting && !replacement.trim()) return setError('Enter the correct spelling');
    setBusy(true);
    setError('');
    try {
      const payload = { phrase: phrase.trim(), replacement: correcting ? replacement.trim() : null };
      if (mode === 'add') payload.share_with_team = share;
      await onSave(payload);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'add' ? 'Add to vocabulary' : correcting ? 'Edit replacement' : 'Edit word'}>
      <form onSubmit={submit} className="space-y-4">
        {correcting ? (
          <div className="flex items-center gap-2">
            <input className="input" placeholder="Misspelling" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoFocus />
            <ArrowRight size={16} className="shrink-0 text-faint" />
            <input className="input" placeholder="Correct spelling" value={replacement} onChange={(e) => setReplacement(e.target.value)} />
          </div>
        ) : (
          <input className="input" placeholder="Add a new word" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoFocus />
        )}
        <div className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5">
          <div>
            <p className="text-sm font-medium text-ink">Correct a misspelling</p>
            <p className="text-xs text-muted">Replace what Flow hears with the right spelling.</p>
          </div>
          <Toggle checked={correcting} onChange={setCorrecting} label="Correct a misspelling" />
        </div>
        {mode === 'add' && <ShareToggle noun="word" hasTeam={hasTeam} checked={share} onChange={setShare} />}
        {error && <p className="text-sm text-flare-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : mode === 'add' ? 'Add word' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
