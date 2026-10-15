// File: src/Style/components/AppsModal.jsx
// Edit which apps belong to a style category (matched against the app's name).
import { useState } from 'react';
import { X } from 'lucide-react';
import { errorMessage } from '../../api/apiClient';
import Modal from '../../components/ui/Modal';

// Mounted only while open, so the list always starts from the saved apps.
export default function AppsModal({ category, apps, onClose, onSave }) {
  const [list, setList] = useState(apps);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = () => {
    const name = draft.trim();
    if (name && !list.some((a) => a.toLowerCase() === name.toLowerCase())) setList([...list, name]);
    setDraft('');
  };

  const save = async () => {
    setBusy(true);
    try {
      await onSave(list);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Apps for ${category}`} subtitle="Murmur uses this style when you dictate into any of these apps.">
      <div className="flex flex-wrap gap-2">
        {list.map((app) => (
          <span key={app} className="inline-flex items-center gap-1 rounded-full bg-subtle py-1 pl-3 pr-1.5 text-sm text-ink">
            {app}
            <button onClick={() => setList(list.filter((a) => a !== app))} className="rounded-full p-0.5 text-faint hover:text-ink" aria-label={`Remove ${app}`}>
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          className="input"
          placeholder="Add an app, e.g. Notion"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button className="btn-secondary" onClick={add} disabled={!draft.trim()}>
          Add
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-flare-500">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}
