// File: src/Snippets/components/SnippetModal.jsx
import { useState } from 'react';
import { errorMessage } from '../../api/apiClient';
import Modal from '../../components/ui/Modal';

const MAX_EXPANSION = 4000;

export default function SnippetModal({ isOpen, mode, entry, onClose, onSave }) {
  const [phrase, setPhrase] = useState(entry?.phrase || '');
  const [replacement, setReplacement] = useState(entry?.replacement || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!phrase.trim() || !replacement.trim()) return setError('Please enter a snippet and its expansion');
    if (replacement.length > MAX_EXPANSION) return setError('This expansion is too long. Please shorten it and try again.');
    setBusy(true);
    setError('');
    try {
      const payload = { phrase: phrase.trim(), replacement };
      await onSave(payload);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'add' ? 'Add snippet' : 'Edit snippet'} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="snippet-trigger">Snippet</label>
          <input id="snippet-trigger" className="input" placeholder="What you'll say, e.g. my calendar link" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoFocus />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="snippet-expansion">Expansion</label>
            <span className={`text-xs ${replacement.length > MAX_EXPANSION ? 'text-flare-500' : 'text-faint'}`}>
              {replacement.length}/{MAX_EXPANSION}
            </span>
          </div>
          <textarea
            id="snippet-expansion"
            className="input min-h-[140px] resize-y"
            placeholder="What Murmur will type, e.g. https://cal.com/you/30min"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-flare-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : mode === 'add' ? 'Add snippet' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
