// File: src/Home/components/FeedbackModal.jsx
import { useState } from 'react';
import Modal from '../../components/ui/Modal';

export default function FeedbackModal({ transcript, onClose, onSubmit }) {
  const [text, setText] = useState(transcript.feedback || '');
  const submit = async () => {
    await onSubmit(text.trim());
    onClose();
  };
  return (
    <Modal isOpen onClose={onClose} title="Report to improve" subtitle="Tell us what Murmur should have written instead.">
      <textarea
        className="input min-h-[110px] resize-y"
        placeholder="Describe what you expected instead"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={!text.trim()}>
          Send feedback
        </button>
      </div>
    </Modal>
  );
}
