// File: desktop/main/dictation.js
// The dictation state machine behind the global shortcuts.
//
//   idle --(push_to_talk down | hands_free | command down)--> starting
//   starting --(microphone open)--> recording
//   recording --(release / press again / Murmur bar stop)--> processing
//   processing --(text pasted | error)--> idle
//   any --(Esc / Murmur bar cancel)--> idle
const { app, clipboard } = require('electron');
const api = require('./api');
const helper = require('./helper');
const bar = require('./flowbar');
const store = require('./store');
const { pasteText, readSelection } = require('./clipboard');
const { MAX_RECORDING_MS, MIN_RECORDING_MS } = require('./config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Back-to-back dictations need a space between them: "...the transcript." +
// "Kapil" must become "...the transcript. Kapil". `before` is what the helper
// read just before the caret (null when the app doesn't expose its text); in
// that case a dictation that follows our own paste into the same window
// within a minute is treated as a continuation.
const NO_SPACE_AFTER = /[\s([{"'“‘/@#-]$/;
const NO_SPACE_BEFORE = /^[\s,.;:!?)\]}'"”’]/;

function withLeadingSpace(text, context, lastPaste) {
  if (!text || NO_SPACE_BEFORE.test(text)) return text;
  let previous = context.before;
  if (previous == null && lastPaste && lastPaste.pid === context.pid && lastPaste.title === context.title && Date.now() - lastPaste.at < 60_000) {
    previous = lastPaste.text;
  }
  return previous && !NO_SPACE_AFTER.test(previous) ? ` ${text}` : text;
}

class DictationController {
  constructor() {
    this.state = 'idle';
    this.mode = null; // push_to_talk | hands_free | command
    this.prefs = null;
    this.startedAt = 0;
    this.pendingStop = false;
    this.tapToStop = false;
    this.maxTimer = null;
    this.abort = null;
    this.muted = false;
    this.contextPromise = null;
    this.lastPaste = null; // { pid, title, text, at } of the last dictation we pasted
    this.hotkeyListeners = new Set();
    this.showHub = () => {};
  }

  // --- preferences / UI ------------------------------------------------------
  setPreferences(prefs) {
    this.prefs = prefs;
    if (this.state === 'idle') this.idle();
  }

  hint() {
    return this.prefs?.shortcuts?.push_to_talk || ['Ctrl', 'Win'];
  }

  idle() {
    bar.setState({ state: 'idle', hint: this.hint(), signedIn: api.hasSession() });
  }

  showBarState() {
    bar.setState({ state: this.state === 'processing' ? 'processing' : 'recording', mode: this.mode, hint: this.hint() });
  }

  sound(name) {
    if (this.prefs?.enable_sounds !== false) bar.playSound(name);
  }

  flash(state, message, ms = 2200) {
    bar.setState({ state, message, hint: this.hint() });
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.state === 'idle' && this.idle(), ms);
  }

  onHotkeyEvent(listener) {
    this.hotkeyListeners.add(listener);
    return () => this.hotkeyListeners.delete(listener);
  }

  // --- hotkeys ---------------------------------------------------------------
  async onHotkey(action, phase) {
    for (const listener of this.hotkeyListeners) listener(action, phase);
    const busy = this.state === 'starting' || this.state === 'recording';
    switch (action) {
      case 'push_to_talk':
        if (phase === 'down') {
          if (this.state === 'idle') return this.start('push_to_talk');
          if (this.mode === 'hands_free' && busy) this.tapToStop = true;
        } else if (phase === 'up') {
          if (this.mode === 'push_to_talk') return this.finish();
          if (this.mode === 'hands_free' && this.tapToStop) {
            this.tapToStop = false;
            return this.finish();
          }
        } else if (phase === 'cancel' && this.mode === 'push_to_talk') {
          // Ctrl+Win was the start of some other Windows shortcut.
          return this.cancel({ quiet: true });
        }
        return undefined;
      case 'hands_free':
        if (this.state === 'idle') return this.start('hands_free');
        if (this.mode === 'push_to_talk' && busy) {
          this.mode = 'hands_free';
          return this.showBarState();
        }
        if (this.mode === 'hands_free' && busy) return this.finish();
        return undefined;
      case 'command_mode':
        if (phase === 'down') {
          if (this.prefs && this.prefs.command_mode_enabled === false) {
            this.cancel({ quiet: true });
            return this.flash('info', 'Command Mode is off in Settings');
          }
          if (this.state === 'idle') return this.start('command');
          // Ctrl+Win started push-to-talk a moment before Alt arrived.
          if (this.mode === 'push_to_talk' && busy) {
            this.mode = 'command';
            return this.showBarState();
          }
        } else if (phase === 'up' && this.mode === 'command') {
          return this.finish();
        } else if (phase === 'cancel' && this.mode === 'command') {
          return this.cancel({ quiet: true });
        }
        return undefined;
      case 'cancel':
        return this.cancel();
      case 'paste_last':
        return this.pasteLast();
      case 'copy_last':
        return this.copyLast();
      default:
        return undefined;
    }
  }

  // --- recording -------------------------------------------------------------
  async start(mode) {
    if (!api.hasSession()) {
      this.flash('error', 'Sign in to Murmur to start dictating');
      this.showHub();
      return;
    }
    this.state = 'starting';
    this.mode = mode;
    this.pendingStop = false;
    this.tapToStop = false;
    this.startedAt = Date.now();
    helper.setRecording(true);
    this.showBarState();
    // Look up the app and text box being dictated into while the user is
    // talking. It stays on this machine unless context awareness is on.
    this.contextPromise = helper.foreground();
    try {
      await bar.startRecording({
        deviceId: this.prefs?.microphone_device_id || null,
        sounds: this.prefs?.enable_sounds !== false,
      });
    } catch (err) {
      this.reset();
      this.flash('error', `Microphone unavailable: ${err.message}`, 4000);
      return;
    }
    if (this.state !== 'starting') return; // cancelled while the mic was opening
    this.state = 'recording';
    if (this.prefs?.mute_audio_while_dictating !== false) {
      // After the start chime, so the chime itself is still audible.
      this.muteTimer = setTimeout(() => {
        if (this.state === 'recording') {
          this.muted = true;
          helper.mute();
        }
      }, 260);
    }
    this.maxTimer = setTimeout(() => this.finish(), MAX_RECORDING_MS);
    if (this.pendingStop) this.finish();
  }

  restoreAudio() {
    clearTimeout(this.muteTimer);
    if (this.muted) {
      this.muted = false;
      helper.unmute();
    }
  }

  reset() {
    clearTimeout(this.maxTimer);
    this.restoreAudio();
    this.state = 'idle';
    this.mode = null;
    this.abort = null;
    helper.setRecording(false);
  }

  async cancel({ quiet = false } = {}) {
    if (this.state === 'idle') return;
    if (this.state === 'processing') this.abort?.abort();
    else await bar.cancelRecording();
    this.reset();
    if (!quiet) {
      this.sound('cancel');
      this.flash('info', 'Dictation cancelled', 1400);
    } else {
      this.idle();
    }
  }

  async finish() {
    if (this.state === 'starting') {
      this.pendingStop = true;
      return;
    }
    if (this.state !== 'recording') return;
    this.state = 'processing';
    const mode = this.mode;
    const heldMs = Date.now() - this.startedAt;
    clearTimeout(this.maxTimer);
    this.restoreAudio();
    this.showBarState();

    let audio;
    try {
      audio = await bar.stopRecording();
    } catch (err) {
      this.reset();
      this.flash('error', `Recording failed: ${err.message}`);
      return;
    }
    if (heldMs < MIN_RECORDING_MS || audio.duration * 1000 < MIN_RECORDING_MS) {
      // An accidental tap ("debounce"): nothing to transcribe.
      this.reset();
      this.flash('info', 'Hold the shortcut while you speak', 1800);
      return;
    }

    const context = (await this.contextPromise) || {};
    const shareContext = this.prefs?.context_awareness !== false;
    const fields = {
      mode,
      app_name: shareContext ? context.app : undefined,
      url: shareContext ? context.url : undefined,
      window_title: shareContext ? context.title : undefined,
      field_name: shareContext ? context.field : undefined,
      device_uid: store.deviceUid(),
      mic_device: this.prefs?.microphone_label,
      app_version: app.getVersion(),
      platform: process.platform,
      timezone_offset_minutes: -new Date().getTimezoneOffset(),
    };
    this.abort = new AbortController();
    try {
      if (mode === 'command') await this.runCommand(audio, fields, context);
      else await this.runDictation(audio, fields, context);
    } catch (err) {
      if (err.name === 'AbortError') return; // cancelled with Esc
      this.reset();
      this.sound('error');
      this.flash('error', err.message || 'Something went wrong', 4000);
    }
  }

  async runDictation(audio, fields, context) {
    const result = await api.transcribe(audio.wav, fields, this.abort.signal);
    if (this.state !== 'processing') return;
    if (result.status !== 'success' || !result.text) {
      this.reset();
      this.flash('error', result.message || "Murmur didn't catch that");
      return;
    }
    await this.paste(result.text, context);
    this.reset();
    this.flash('success', '', 900);
  }

  async runCommand(audio, fields, context) {
    // The selection is read now that the user has let go of the keys.
    const selected = helper.ready ? await readSelection(() => helper.copy()) : '';
    const result = await api.command(audio.wav, { ...fields, selected_text: selected }, this.abort.signal);
    if (this.state !== 'processing') return;
    if (result.status !== 'success' || !result.output) {
      this.reset();
      this.flash('error', result.message || "Murmur didn't catch that command");
      return;
    }
    // A rewrite replaces the selection as-is; new text gets normal spacing.
    await this.paste(result.output, selected ? null : context);
    this.reset();
    this.flash('success', selected ? 'Rewrote your selection' : '', 1400);
  }

  // --- output ----------------------------------------------------------------
  // context: what the helper saw at the cursor (for spacing), or null.
  async paste(text, context = null) {
    const typed = context ? withLeadingSpace(text, context, this.lastPaste) : text;
    if (!helper.ready) {
      // No native helper (or not on Windows): leave the text on the clipboard.
      await clipboard.writeText(typed);
      bar.toast('Copied - press Ctrl+V to paste');
      return;
    }
    await pasteText(typed, () => helper.paste());
    if (context) this.lastPaste = { pid: context.pid, title: context.title, text, at: Date.now() };
  }

  async pasteLast() {
    if (this.state !== 'idle') return;
    try {
      const [last, context] = await Promise.all([api.lastTranscript(), helper.foreground()]);
      await sleep(80);
      await this.paste(last.text, context || null);
    } catch (err) {
      this.flash('error', err.status === 404 ? 'Nothing dictated yet' : err.message);
    }
  }

  async copyLast() {
    try {
      const last = await api.lastTranscript();
      await clipboard.writeText(last.text);
      bar.toast('Copied last transcript');
    } catch (err) {
      this.flash('error', err.status === 404 ? 'Nothing dictated yet' : err.message);
    }
  }
}

module.exports = new DictationController();
module.exports.withLeadingSpace = withLeadingSpace; // exported for tests
