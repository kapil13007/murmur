// File: src/components/HelpModal.jsx
import { useApp } from '../context/AppContext';
import KeyCombo from './ui/KeyCombo';
import Modal from './ui/Modal';
import { SHORTCUT_ACTIONS } from '../utils/shortcuts';

const TIPS = [
  ['Self-corrections', 'Say "at 3, actually 4" or "scratch that" and only the final version is typed.'],
  ['Spoken formatting', 'Say "new line", "new paragraph" or "question mark", or list items as "one…, two…, three…".'],
  ['Snippets', 'Say a snippet trigger like "my calendar link" and Flow pastes the full text.'],
  ['Styles', 'Flow formats differently in chats, work apps and email. Tune it on the Style page.'],
  ['Command Mode', 'Select text, hold the command shortcut and say "make this more formal".'],
];

export default function HelpModal({ isOpen, onClose }) {
  const { preferences, isDesktop } = useApp();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="How to use Flow" subtitle="Speak anywhere you can type." size="lg">
      <div className="space-y-6">
        <div>
          <p className="section-label mb-2">Shortcuts</p>
          <div className="divide-y divide-line rounded-xl border border-line">
            {SHORTCUT_ACTIONS.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink">{a.title}</p>
                  <p className="text-xs text-muted">{a.description}</p>
                </div>
                <KeyCombo keys={preferences?.shortcuts?.[a.id]} />
              </div>
            ))}
          </div>
          {!isDesktop && (
            <p className="mt-2 text-xs text-muted">
              Global shortcuts work in the Whisper Flow desktop app. In the browser, use the microphone button on Home.
            </p>
          )}
        </div>
        <div>
          <p className="section-label mb-2">Tips</p>
          <ul className="space-y-2.5">
            {TIPS.map(([title, body]) => (
              <li key={title} className="text-sm">
                <span className="font-semibold text-ink">{title}. </span>
                <span className="text-muted">{body}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
