// File: src/components/entries/ImportModal.jsx
import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { errorMessage } from '../../api/apiClient';
import Modal from '../ui/Modal';

export default function ImportModal({ isOpen, noun, help, onClose, onImport }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const readFile = async (file) => {
    if (!file) return;
    setText(await file.text());
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      setResult(await onImport(text));
      setText('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setResult(null);
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={`Import ${noun}s`} subtitle={help} size="lg">
      <textarea
        className="input min-h-[180px] resize-y font-mono text-[13px]"
        placeholder={noun === 'word' ? 'Kubernetes\nwisper flow -> Wispr Flow' : 'my calendar link => https://cal.com/you\nmy address => 221B Baker Street'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-ink">
        <FileUp size={15} /> Load from a .txt or .csv file
        <input type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
      </label>
      {result && (
        <p className="mt-3 rounded-xl bg-fathom-50 px-3 py-2 text-sm text-fathom-900 dark:bg-fathom-950 dark:text-fathom-100">
          Imported {result.created}, skipped {result.skipped}.
          {result.errors?.length ? ` ${result.errors.join('; ')}` : ''}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-flare-500">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={close}>
          Close
        </button>
        <button className="btn-primary" onClick={submit} disabled={busy || !text.trim()}>
          {busy ? 'Importing…' : 'Import'}
        </button>
      </div>
    </Modal>
  );
}
