// File: src/Home/components/EditTranscriptModal.jsx
import { useState } from 'react';
import Modal from '../../components/ui/Modal';

// Mounted only while open, so the draft always starts from the latest text.
export default function EditTranscriptModal({ transcript, onClose, onSave }) {
  const [text, setText] = useState(transcript.text);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit transcript"
      subtitle="Fix names or terms Murmur got wrong — they'll be added to your dictionary automatically."
      size="lg"
    >
      <textarea className="input min-h-[160px] resize-y text-[15px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      {transcript.asr_text && (
        <details className="mt-3 text-xs text-muted">
          <summary className="cursor-pointer select-none">What you originally said</summary>
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-subtle p-3 text-sm text-muted">{transcript.asr_text}</p>
        </details>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={save} disabled={busy || !text.trim() || text === transcript.text}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}
