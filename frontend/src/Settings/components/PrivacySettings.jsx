// File: src/Settings/components/PrivacySettings.jsx
// Data and Privacy: retention, audio, context awareness, export, wipe.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { deleteAllHistory, errorMessage, exportData } from '../../api/apiClient';
import { useApp } from '../../context/AppContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import SettingRow, { PrefToggle, SettingSection } from './SettingRow';

const RETENTION = [
  { id: 'store', label: 'Store data', description: 'Keep your transcripts so you can search, edit and retry them.' },
  { id: 'auto_delete_24h', label: 'Auto-delete data every 24hrs', description: 'Transcripts older than a day are deleted automatically.' },
  { id: 'never_store', label: 'Never store data', description: 'Dictation still works, but nothing is saved to your history.' },
];

export default function PrivacySettings() {
  const { preferences: prefs, savePreferences: save } = useApp();
  const [pending, setPending] = useState(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [exporting, setExporting] = useState(false);
  if (!prefs) return null;

  const chooseRetention = (id) => {
    if (id === prefs.data_retention) return;
    if (id === 'store') save({ data_retention: id });
    else setPending(id);
  };

  const download = async () => {
    setExporting(true);
    try {
      const data = await exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `whisper-flow-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <SettingSection title="Data storage">
        <div className="space-y-2 p-4">
          {RETENTION.map((r) => (
            <label key={r.id} className={clsx('flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3', prefs.data_retention === r.id ? 'border-ink' : 'border-line hover:bg-subtle/60')}>
              <input type="radio" name="retention" className="mt-1 h-4 w-4 accent-vast-950" checked={prefs.data_retention === r.id} onChange={() => chooseRetention(r.id)} />
              <span>
                <span className="block text-sm font-medium text-ink">{r.label}</span>
                <span className="block text-xs text-muted">{r.description}</span>
              </span>
            </label>
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Privacy">
        <PrefToggle
          prefs={prefs}
          save={save}
          field="privacy_mode"
          label="Privacy mode"
          description="Never keep recordings. Transcripts can't be replayed or retried."
        />
        <PrefToggle
          prefs={prefs}
          save={save}
          field="context_awareness"
          label="Context awareness"
          description="Use the app or website you're dictating into to pick the right style. Off: everything uses your Other style."
        />
      </SettingSection>

      <SettingSection title="Your data">
        <SettingRow label="Download your data" description="Everything Murmur stores about you, as a JSON file.">
          <button className="btn-secondary px-3 py-1.5" onClick={download} disabled={exporting}>
            <Download size={14} /> {exporting ? 'Preparing…' : 'Download'}
          </button>
        </SettingRow>
        <SettingRow label="Delete all history" description="Deletes every transcript, transform and command. Your stats are kept.">
          <button className="btn-ghost px-3 py-1.5 text-flare-500 hover:bg-flare-50 dark:hover:bg-flare-600/20" onClick={() => setConfirmWipe(true)}>
            <Trash2 size={14} /> Delete
          </button>
        </SettingRow>
      </SettingSection>

      <ConfirmModal
        isOpen={Boolean(pending)}
        onClose={() => setPending(null)}
        confirmLabel="Yes, continue"
        title={pending === 'never_store' ? 'Are you sure you want to never store data?' : 'Are you sure you want to auto-delete data?'}
        message={
          pending === 'never_store'
            ? 'New dictations will not be saved to your history. Existing history stays until you delete it.'
            : 'Transcripts and transform history older than 24 hours will be deleted, now and from now on.'
        }
        onConfirm={() => save({ data_retention: pending })}
      />
      <ConfirmModal
        isOpen={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        title="Delete all history?"
        message="All transcripts, recordings, transforms and command history will be deleted permanently."
        onConfirm={async () => {
          const res = await deleteAllHistory();
          toast.success(`Deleted ${res.deleted.transcripts} transcripts`);
        }}
      />
    </div>
  );
}
