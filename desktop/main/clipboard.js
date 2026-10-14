// File: desktop/main/clipboard.js
// Paste text into the focused app without losing what the user had copied:
// snapshot every clipboard format, put our text on it, send Ctrl+V, then put
// the original back. (Electron 44's clipboard API is async and W3C-shaped.)
const { clipboard, ClipboardItem } = require('electron');
const { PASTE_RESTORE_DELAY_MS } = require('./config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reads every format eagerly so the data survives the clipboard changing.
async function snapshot() {
  try {
    const items = await clipboard.read();
    const saved = [];
    for (const item of items) {
      const entry = {};
      for (const type of item.types) {
        try {
          entry[type] = await item.getType(type);
        } catch {
          // A format the platform can't hand back; skip it.
        }
      }
      if (Object.keys(entry).length) saved.push(entry);
    }
    return saved;
  } catch {
    return null;
  }
}

async function restore(saved) {
  if (!saved) return;
  try {
    if (saved.length) await clipboard.write(saved.map((entry) => new ClipboardItem(entry)));
    else await clipboard.clear();
  } catch (err) {
    console.warn('[clipboard] restore failed:', err.message);
  }
}

// pasteKeystroke: async () => sends Ctrl+V to the focused app.
async function pasteText(text, pasteKeystroke) {
  const saved = await snapshot();
  await clipboard.writeText(text);
  await pasteKeystroke();
  await sleep(PASTE_RESTORE_DELAY_MS);
  // If the user copied something new meanwhile, leave their copy alone.
  if ((await clipboard.readText()) === text) await restore(saved);
}

// Copies the current selection in the focused app and returns it ('' if
// nothing was selected), leaving the clipboard as it was.
async function readSelection(copyKeystroke) {
  const saved = await snapshot();
  const sentinel = `⁣flow-selection-${Date.now()}`;
  await clipboard.writeText(sentinel);
  await copyKeystroke();
  let selected = '';
  for (let i = 0; i < 12; i++) {
    await sleep(40);
    const current = await clipboard.readText();
    if (current !== sentinel) {
      selected = current;
      break;
    }
  }
  await restore(saved);
  return selected;
}

module.exports = { pasteText, readSelection, snapshot, restore };
