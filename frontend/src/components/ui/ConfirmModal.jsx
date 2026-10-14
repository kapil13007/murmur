// File: src/components/ui/ConfirmModal.jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '../../api/apiClient';
import Modal from './Modal';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Yes, delete it',
  cancelLabel = 'Cancel',
  danger = true,
  children,
}) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      // Keep the dialog open so the user can retry; report the error unless
      // the caller already did (it marks those errors as handled).
      if (!err?.handled) toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" hideClose>
      {message && <p className="text-sm text-muted">{message}</p>}
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={confirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
