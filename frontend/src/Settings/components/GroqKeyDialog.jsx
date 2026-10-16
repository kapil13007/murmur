// File: src/Settings/components/GroqKeyDialog.jsx
// Where a user pastes their own Groq API key. Murmur's server never pays for
// anyone's speech-to-text: the key is checked with Groq, stored encrypted and
// only its last four characters are ever shown again.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ExternalLink } from 'lucide-react';
import { errorMessage, removeGroqKey, saveGroqKey } from '../../api/apiClient';
import { useApp } from '../../context/AppContext';
import Modal from '../../components/ui/Modal';

export default function GroqKeyDialog({ onClose }) {
  const { groqKey, setGroqKey } = useApp();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setGroqKey(await saveGroqKey(value));
      toast.success('Groq key saved. You can start dictating.');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      setGroqKey(await removeGroqKey());
      toast.success('Groq key removed');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Groq API key"
      subtitle="Murmur uses Groq for fast speech recognition and cleanup. It's free, and the key is yours."
    >
      <form onSubmit={save} className="space-y-4">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>
            Open{' '}
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-4">
              console.groq.com/keys <ExternalLink size={12} />
            </a>{' '}
            and sign in (no card needed).
          </li>
          <li>Click “Create API key”, give it any name, and copy it.</li>
          <li>Paste it below.</li>
        </ol>
        <div>
          <label className="label" htmlFor="groq-key">
            API key {groqKey?.has_key && <span className="font-normal text-faint">(current key ends in {groqKey.last4})</span>}
          </label>
          <input
            id="groq-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="input font-mono"
            placeholder="gsk_…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <p className="text-xs text-faint">Your key is encrypted on the server and used only for your own dictations. Groq bills usage to you; the free tier is plenty for daily dictation.</p>
        {error && <p className="text-sm text-flare-500">{error}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          {groqKey?.has_key ? (
            <button type="button" className="btn-secondary text-flare-500" onClick={remove} disabled={busy}>
              Remove key
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy || !value.trim()}>
              {busy ? 'Checking…' : 'Save key'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
