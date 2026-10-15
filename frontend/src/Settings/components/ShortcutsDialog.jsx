// File: src/Settings/components/ShortcutsDialog.jsx
// Change hotkeys. In the desktop app keys are captured by the native helper
// (so Win-key combos work); in a browser they're captured from key events.
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { desktop } from '../../desktop/bridge';
import { comboId, keyNameFromEvent, SHORTCUT_ACTIONS, sortKeys } from '../../utils/shortcuts';
import KeyCombo from '../../components/ui/KeyCombo';
import Modal from '../../components/ui/Modal';

const DEFAULTS = {
  push_to_talk: ['Ctrl', 'Win'],
  hands_free: ['Ctrl', 'Win', 'Space'],
  command_mode: ['Ctrl', 'Win', 'Alt'],
  paste_last: ['Shift', 'Alt', 'Z'],
  copy_last: ['Shift', 'Alt', 'X'],
  cancel: ['Esc'],
};

// Exists only while capturing: shows the keys being held and reports the
// largest combination once every key is released.
function ComboCapture({ onDone }) {
  const [preview, setPreview] = useState([]);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const done = (keys) => onDoneRef.current(keys);
    if (desktop?.captureShortcut) {
      let cancelled = false;
      desktop
        .captureShortcut()
        .then((keys) => !cancelled && keys && done(keys))
        .catch(() => {});
      const off = desktop.onShortcutPreview?.((keys) => setPreview(keys));
      return () => {
        cancelled = true;
        desktop.cancelShortcutCapture?.();
        off?.();
      };
    }

    const held = new Set();
    let best = [];
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = keyNameFromEvent(e);
      if (!name) return;
      held.add(name);
      if (held.size >= best.length) best = sortKeys([...held]);
      setPreview(best);
    };
    const up = (e) => {
      e.preventDefault();
      const name = keyNameFromEvent(e);
      if (name) held.delete(name);
      if (held.size === 0 && best.length) done(best.slice(0, 4));
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, []);

  return (
    <span className="rounded-xl border border-dashed border-dawn-700 px-3 py-1.5 text-sm text-dawn-800 dark:text-dawn-300">
      {preview.length ? <KeyCombo keys={preview} /> : 'Press your shortcut…'}
    </span>
  );
}

export default function ShortcutsDialog({ onClose }) {
  const { preferences, savePreferences, isDesktop } = useApp();
  const [capturing, setCapturing] = useState(null);

  const finish = async (keys) => {
    const action = capturing;
    setCapturing(null);
    const clash = Object.entries(preferences.shortcuts).find(([a, k]) => a !== action && k && comboId(k) === comboId(keys));
    if (clash) {
      toast.error(`That shortcut is already used for ${SHORTCUT_ACTIONS.find((a) => a.id === clash[0])?.title}`);
      return;
    }
    await savePreferences({ shortcuts: { [action]: keys } }).then(() => toast.success('Shortcut updated'), () => {});
  };

  const reset = async () => {
    await savePreferences({ shortcuts: DEFAULTS });
    toast.success('Reset to default');
  };

  const pttKeys = preferences.shortcuts.push_to_talk || [];
  const handsFreeKeys = preferences.shortcuts.hands_free || [];
  const overlap = handsFreeKeys.length && handsFreeKeys.length < pttKeys.length && handsFreeKeys.every((k) => pttKeys.includes(k));

  return (
    <Modal isOpen onClose={() => (capturing ? setCapturing(null) : onClose())} title="Shortcuts" subtitle="Choose your preferred shortcuts for using Murmur." size="xl">
      {!isDesktop && (
        <p className="mb-4 rounded-xl bg-subtle px-4 py-2.5 text-xs text-muted">
          Global shortcuts run in the Murmur desktop app. Browsers can&apos;t see the Windows key, so set Win-key combos from the desktop app.
        </p>
      )}
      <div className="divide-y divide-line rounded-2xl border border-line">
        {SHORTCUT_ACTIONS.map((action) => (
          <div key={action.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink">{action.title}</p>
              <p className="text-xs text-muted">{action.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {capturing === action.id ? <ComboCapture onDone={finish} /> : <KeyCombo keys={preferences.shortcuts[action.id]} />}
              <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setCapturing(capturing === action.id ? null : action.id)}>
                {capturing === action.id ? 'Cancel' : 'Change'}
              </button>
              {!action.required && preferences.shortcuts[action.id] && capturing !== action.id && (
                <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => savePreferences({ shortcuts: { [action.id]: null } })}>
                  Clear
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {overlap ? (
        <p className="mt-3 text-xs text-glow-500">Warning: your Hands-free shortcut is part of your Push-to-talk shortcut. This may lead to conflicts.</p>
      ) : null}
      <div className="mt-5 flex justify-between">
        <button className="btn-ghost" onClick={reset}>
          Reset to default
        </button>
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
