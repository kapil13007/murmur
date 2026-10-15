// File: src/Settings/components/LanguagesDialog.jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { LANGUAGES } from '../../utils/languages';
import Modal from '../../components/ui/Modal';
import SearchInput from '../../components/ui/SearchInput';

export default function LanguagesDialog({ onClose }) {
  const { preferences, savePreferences } = useApp();
  const [selected, setSelected] = useState(new Set(preferences.selected_languages));
  const [query, setQuery] = useState('');
  const auto = selected.size === 0;
  const visible = LANGUAGES.filter((l) => l.name.toLowerCase().includes(query.toLowerCase()));

  const toggle = (code) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const save = async () => {
    await savePreferences({ selected_languages: [...selected] });
    toast.success('Languages updated');
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Dictation languages"
      subtitle="Pick one language for the best accuracy. With several (or none), Murmur detects the language each time you speak."
      size="lg"
    >
      <SearchInput value={query} onChange={setQuery} placeholder="Search language" />
      <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3">
        <input type="checkbox" className="h-4 w-4 accent-vast-950" checked={auto} onChange={() => setSelected(new Set())} />
        <span className="text-sm font-medium text-ink">Auto-detect (99 languages)</span>
      </label>
      <div className="mt-2 grid max-h-72 grid-cols-2 gap-1 overflow-y-auto">
        {visible.map((l) => (
          <label key={l.code} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-subtle">
            <input type="checkbox" className="h-4 w-4 accent-vast-950" checked={selected.has(l.code)} onChange={() => toggle(l.code)} />
            <span className="text-sm text-ink">{l.name}</span>
          </label>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </Modal>
  );
}
