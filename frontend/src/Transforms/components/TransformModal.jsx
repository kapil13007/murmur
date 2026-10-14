// File: src/Transforms/components/TransformModal.jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import { createTransform, errorMessage, updateTransform } from '../../api/apiClient';
import Modal from '../../components/ui/Modal';

export default function TransformModal({ isOpen, mode, transform, onClose, onSaved }) {
  const [name, setName] = useState(transform?.name || '');
  const [instruction, setInstruction] = useState(transform?.instruction || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'add') await createTransform({ name: name.trim(), instruction: instruction.trim() });
      else await updateTransform(transform.id, { name: name.trim(), instruction: instruction.trim() });
      toast.success(mode === 'add' ? 'Transform created' : 'Transform updated');
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'add' ? 'New transform' : 'Edit transform'} subtitle="A reusable instruction you can run on any text." size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="t-name">Name</label>
          <input id="t-name" className="input" placeholder="e.g. Tweet-length" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="t-instruction">Instruction</label>
          <textarea
            id="t-instruction"
            className="input min-h-[110px] resize-y"
            placeholder="e.g. Rewrite this as a single tweet under 280 characters, keep the key point."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-flare-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim() || instruction.trim().length < 3}>
            {busy ? 'Saving…' : mode === 'add' ? 'Create transform' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
