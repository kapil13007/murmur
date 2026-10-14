// File: src/desktop/bridge.js
// When the hub runs inside the Electron desktop app, the preload script
// exposes `window.flowDesktop` (global hotkeys, the Flow Bar, pasting into
// other apps). In a normal browser it's undefined and the hub falls back to
// in-page dictation.
export const desktop = typeof window !== 'undefined' ? window.flowDesktop : undefined;
export const isDesktop = Boolean(desktop);
