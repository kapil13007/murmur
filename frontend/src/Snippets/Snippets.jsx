// File: src/Snippets/Snippets.jsx
import { Scissors } from 'lucide-react';
import { snippetsApi } from '../api/apiClient';
import EntriesPage from '../components/entries/EntriesPage';
import SnippetModal from './components/SnippetModal';

function SnippetsBanner() {
  return (
    <div className="mt-6 grid gap-6 overflow-hidden rounded-2xl bg-gradient-to-r from-glow-50 to-signal-100 px-7 py-6 dark:from-vast-900 dark:to-vast-800 sm:grid-cols-[1fr_auto]">
      <div>
        <p className="font-display text-[26px] leading-tight text-ink">The stuff you shouldn&apos;t have to re-type.</p>
        <p className="mt-1.5 max-w-md text-sm text-muted">
          Save shortcuts for things you say often. Say the trigger while dictating and Murmur pastes the full text — links,
          addresses, sign-offs, prompts.
        </p>
      </div>
      <div className="self-center rounded-xl border border-line bg-panel/80 p-3 text-sm">
        <p className="text-muted">
          You say <span className="font-semibold text-ink">&ldquo;my calendar link&rdquo;</span>
        </p>
        <p className="mt-1 text-muted">
          Murmur types <span className="font-semibold text-fathom-800 dark:text-fathom-300">cal.com/you/30min</span>
        </p>
      </div>
    </div>
  );
}

const CONFIG = {
  api: snippetsApi,
  title: 'Snippets',
  noun: 'snippet',
  emptyIcon: Scissors,
  banner: <SnippetsBanner />,
  EntryModal: SnippetModal,
  importHelp: 'One snippet per line as "trigger => expansion". CSV "trigger,expansion" also works.',
};

export default function Snippets() {
  return <EntriesPage config={CONFIG} />;
}
