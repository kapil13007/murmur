// File: src/Transforms/Transforms.jsx
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import {
  deleteTransform,
  errorMessage,
  getCommandHistory,
  getHealth,
  getTransformHistory,
  getTransforms,
  updateTransform,
} from '../api/apiClient';
import { PageSpinner } from '../components/ui/Spinner';
import ConfirmModal from '../components/ui/ConfirmModal';
import Tabs from '../components/ui/Tabs';
import Playground from './components/Playground';
import PolishSettings from './components/PolishSettings';
import RunHistory from './components/RunHistory';
import TransformModal from './components/TransformModal';
import TransformRow from './components/TransformRow';

export default function Transforms() {
  const [transforms, setTransforms] = useState(null);
  const [llm, setLlm] = useState(null);
  const [runs, setRuns] = useState([]);
  const [commands, setCommands] = useState([]);
  const [historyTab, setHistoryTab] = useState('transforms');
  const [modal, setModal] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const loadHistory = useCallback(() => {
    getTransformHistory().then(setRuns).catch(() => {});
    getCommandHistory().then(setCommands).catch(() => {});
  }, []);

  const load = useCallback(() => {
    getTransforms()
      .then(setTransforms)
      .catch((err) => toast.error(errorMessage(err)));
  }, []);

  useEffect(() => {
    load();
    loadHistory();
    getHealth()
      .then((h) => setLlm(h.llm))
      .catch(() => {});
  }, [load, loadHistory]);

  if (!transforms) return <PageSpinner />;

  const toggle = async (t) => {
    setTransforms((list) => list.map((x) => (x.id === t.id ? { ...x, is_enabled: !x.is_enabled } : x)));
    try {
      await updateTransform(t.id, { is_enabled: !t.is_enabled });
    } catch (err) {
      toast.error(errorMessage(err));
      load();
    }
  };

  return (
    <div>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Transforms</h1>
          <p className="mt-1 text-sm text-muted">Rewrite any text in one click — or select text anywhere and use Command Mode by voice.</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>
          <Plus size={16} /> New transform
        </button>
      </header>

      {llm && !llm.enabled && (
        <div className="mt-6 rounded-2xl border border-glow-200 bg-glow-50 px-5 py-3.5 text-sm text-glow-500 dark:border-vast-700 dark:bg-vast-800 dark:text-glow-200">
          Running offline: built-in transforms and simple commands (tone, cleanup, lists, case, summaries) work without an AI
          provider. For custom instructions, set <code className="font-mono">LLM_PROVIDER</code> and an API key in{' '}
          <code className="font-mono">backend/.env</code>.
        </div>
      )}

      <Playground transforms={transforms.filter((t) => t.is_enabled)} onRun={loadHistory} />

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-ink">Your transforms</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-raised">
          {transforms.map((t) => (
            <TransformRow key={t.id} transform={t} onToggle={() => toggle(t)} onEdit={() => setModal({ mode: 'edit', transform: t })} onDelete={() => setToDelete(t)} />
          ))}
        </div>
      </section>

      <PolishSettings />

      <section className="mt-10">
        <Tabs
          value={historyTab}
          onChange={setHistoryTab}
          tabs={[
            { id: 'transforms', label: 'Transform history', count: runs.length },
            { id: 'commands', label: 'Command Mode history', count: commands.length },
          ]}
        />
        <RunHistory kind={historyTab} runs={historyTab === 'transforms' ? runs : commands} />
      </section>

      {modal && <TransformModal isOpen mode={modal.mode} transform={modal.transform} onClose={() => setModal(null)} onSaved={load} />}
      <ConfirmModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await deleteTransform(toDelete.id);
          toast.success('Transform deleted');
          load();
        }}
        title={`Delete "${toDelete?.name}"?`}
        message="This custom transform will be removed. Past runs stay in your history."
      />
    </div>
  );
}
