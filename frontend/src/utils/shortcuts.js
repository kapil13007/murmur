// File: src/utils/shortcuts.js
// Shortcut actions, their labels (Wispr's Settings > Shortcuts copy) and
// helpers for capturing a key combination in the browser.

export const SHORTCUT_ACTIONS = [
  { id: 'push_to_talk', title: 'Push to talk', description: 'Hold to say something short', required: true },
  { id: 'hands_free', title: 'Hands-free mode', description: 'Press once to start and again to stop dictating' },
  { id: 'command_mode', title: 'Command Mode', description: 'Select text, hold and say how to change it' },
  { id: 'paste_last', title: 'Paste last transcript', description: 'Paste the last thing you dictated' },
  { id: 'copy_last', title: 'Copy last transcript', description: 'Copy the last thing you dictated' },
  { id: 'cancel', title: 'Cancel', description: 'Dismiss dictation and notifications' },
];

const ORDER = ['Ctrl', 'Win', 'Alt', 'Shift'];

export function sortKeys(keys) {
  return [...keys].sort((a, b) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
}

// KeyboardEvent -> our key names ("Ctrl", "Win", "A", "F5", "Space", ...).
export function keyNameFromEvent(e) {
  if (e.key === 'Control') return 'Ctrl';
  if (e.key === 'Meta' || e.key === 'OS') return 'Win';
  if (e.key === 'Alt' || e.key === 'AltGraph') return 'Alt';
  if (e.key === 'Shift') return 'Shift';
  if (e.key === ' ' || e.code === 'Space') return 'Space';
  if (e.key === 'Escape') return 'Esc';
  if (e.key === 'Enter') return 'Enter';
  if (e.key === 'Tab') return 'Tab';
  if (e.key === 'Backspace') return 'Backspace';
  if (e.key === 'CapsLock') return 'CapsLock';
  if (/^F\d{1,2}$/.test(e.key)) return e.key;
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  return null;
}

export const comboId = (keys) => (keys ? sortKeys(keys).join('+') : '');
