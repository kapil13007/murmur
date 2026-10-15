// File: desktop/renderer/flowbar/flowbar.js
// Murmur bar renderer: draws the pill (idle / listening / processing / result),
// records the microphone when the main process asks, and plays the chimes.
/* global flowBar */
(() => {
  const SAMPLE_RATE = 16000;

  const stage = document.getElementById('stage');
  const pill = document.getElementById('pill');
  const canvas = document.getElementById('wave');
  const bubble = document.getElementById('bubble');
  const bubbleText = document.getElementById('bubble-text');
  const g = canvas.getContext('2d');

  let view = { state: 'idle', hint: ['Ctrl', 'Win'], signedIn: true };
  let hovering = false;
  let toast = null; // { message: string | () => Node, kind }
  let toastTimer = null;

  // ---------------------------------------------------------------------------
  // Recorder: microphone -> 16 kHz AudioWorklet -> 16-bit PCM WAV.
  // The AudioContext is created once and suspended between dictations; the
  // microphone itself is only open while Murmur is listening.
  // ---------------------------------------------------------------------------
  const recorder = (() => {
    let ctx = null;
    let stream = null;
    let source = null;
    let node = null;
    let analyser = null;
    let chunks = [];
    let smoothed = 0;
    const scratch = new Float32Array(1024);

    async function context() {
      if (!ctx) {
        ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' });
        await ctx.audioWorklet.addModule('recorder-worklet.js');
      }
      if (ctx.state !== 'running') await ctx.resume();
      return ctx;
    }

    async function openMicrophone(deviceId) {
      const audio = { channelCount: 1, noiseSuppression: true, autoGainControl: true, echoCancellation: false };
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { ...audio, deviceId: { exact: deviceId } } : audio,
        });
      } catch (err) {
        // The chosen microphone is unplugged: use the system default instead.
        if (deviceId && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
          return navigator.mediaDevices.getUserMedia({ audio });
        }
        throw err;
      }
    }

    function release() {
      node?.port.close();
      node?.disconnect();
      source?.disconnect();
      analyser?.disconnect();
      stream?.getTracks().forEach((track) => track.stop());
      node = source = analyser = stream = null;
      smoothed = 0;
      if (ctx?.state === 'running') ctx.suspend().catch(() => {});
    }

    async function start({ deviceId }) {
      release();
      const [audioCtx, mic] = await Promise.all([context(), openMicrophone(deviceId)]);
      stream = mic;
      source = audioCtx.createMediaStreamSource(stream);
      node = new AudioWorkletNode(audioCtx, 'recorder-processor');
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      chunks = [];
      node.port.onmessage = (event) => chunks.push(event.data);
      source.connect(node);
      source.connect(analyser);
    }

    async function stop() {
      if (!node) throw new Error('Murmur was not recording');
      // Let the worklet hand over its last batch of samples.
      await new Promise((resolve) => setTimeout(resolve, 120));
      const recorded = chunks;
      chunks = [];
      release();
      const length = recorded.reduce((sum, chunk) => sum + chunk.length, 0);
      const samples = new Float32Array(length);
      let offset = 0;
      let peak = 0;
      for (const chunk of recorded) {
        samples.set(chunk, offset);
        offset += chunk.length;
        for (const v of chunk) peak = Math.max(peak, Math.abs(v));
      }
      return { wav: encodeWav(samples), duration: length / SAMPLE_RATE, peak };
    }

    function cancel() {
      chunks = [];
      release();
    }

    // Smoothed input level, 0..1, for the waveform.
    function level() {
      if (!analyser) return 0;
      analyser.getFloatTimeDomainData(scratch);
      let sum = 0;
      for (const v of scratch) sum += v * v;
      const target = Math.min(1, Math.sqrt(sum / scratch.length) * 7);
      smoothed = target > smoothed ? smoothed * 0.4 + target * 0.6 : smoothed * 0.86 + target * 0.14;
      return smoothed;
    }

    return { start, stop, cancel, level };
  })();

  function encodeWav(samples) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const dv = new DataView(buffer);
    const ascii = (offset, text) => {
      for (let i = 0; i < text.length; i++) dv.setUint8(offset + i, text.charCodeAt(i));
    };
    ascii(0, 'RIFF');
    dv.setUint32(4, 36 + samples.length * 2, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    dv.setUint32(16, 16, true); // fmt chunk size
    dv.setUint16(20, 1, true); // PCM
    dv.setUint16(22, 1, true); // mono
    dv.setUint32(24, SAMPLE_RATE, true);
    dv.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
    dv.setUint16(32, 2, true); // block align
    dv.setUint16(34, 16, true); // bits per sample
    ascii(36, 'data');
    dv.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (const s of samples) {
      const v = Math.max(-1, Math.min(1, s));
      dv.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      offset += 2;
    }
    return new Uint8Array(buffer);
  }

  function microphoneError(err) {
    switch (err?.name) {
      case 'NotAllowedError':
        return 'Microphone access is blocked. Allow it in Windows Settings > Privacy & security > Microphone.';
      case 'NotFoundError':
        return 'No microphone found. Plug one in or pick another in Settings.';
      case 'NotReadableError':
        return 'The microphone is busy in another app.';
      default:
        return err?.message || String(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Chimes, synthesised so there are no audio files to ship.
  // ---------------------------------------------------------------------------
  const chimes = (() => {
    let ctx = null;
    const PATTERNS = {
      // [frequency Hz, offset s, duration s]
      start: [[740, 0, 0.09], [988, 0.07, 0.13]],
      stop: [[880, 0, 0.08], [660, 0.06, 0.13]],
      cancel: [[523, 0, 0.09], [392, 0.08, 0.15]],
      error: [[311, 0, 0.12], [311, 0.16, 0.14]],
    };
    function play(name) {
      const pattern = PATTERNS[name];
      if (!pattern) return;
      ctx = ctx || new AudioContext();
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      const t0 = ctx.currentTime + 0.01;
      for (const [frequency, at, duration] of pattern) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = name === 'error' ? 'triangle' : 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(name === 'error' ? 0.09 : 0.12, t0 + at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + duration + 0.03);
      }
    }
    return { play };
  })();

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function kbdHint(prefix, keys, suffix) {
    const frag = document.createDocumentFragment();
    frag.append(prefix);
    (keys || []).forEach((key, i) => {
      if (i) frag.append(' + ');
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      frag.append(kbd);
    });
    frag.append(suffix);
    return frag;
  }

  function setBubble(content, kind = '') {
    if (!content) {
      bubble.hidden = true;
      return;
    }
    bubble.className = `bubble ${kind}`;
    bubbleText.replaceChildren(content);
    bubble.hidden = false;
  }

  function showToast(message, kind = '', ms = 2200) {
    toast = { message, kind };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast = null;
      render();
    }, ms);
    render();
  }

  function renderBubble() {
    const { state, mode, message, hint, signedIn } = view;
    if (state === 'error' || state === 'info') return setBubble(message, state);
    if (state === 'success' && message) return setBubble(message, 'success');
    // Toast content can be a builder: a DOM fragment empties once inserted.
    if (toast) return setBubble(typeof toast.message === 'function' ? toast.message() : toast.message, toast.kind);
    if (state === 'recording' && mode === 'command') {
      return setBubble('Command Mode: say what to do with the selected text', 'command');
    }
    if (state === 'idle' && hovering) {
      return setBubble(
        signedIn === false ? 'Sign in to start dictating' : kbdHint('Click or hold ', hint, ' to start dictating'),
      );
    }
    return setBubble(null);
  }

  function render() {
    const { state, mode } = view;
    pill.className = `pill ${state}${hovering && state === 'idle' ? ' hover' : ''}`;
    pill.dataset.mode = mode || '';
    renderBubble();
    startWave();
  }

  // --- waveform -------------------------------------------------------------
  const MAX_BARS = 15;
  const heights = new Float32Array(MAX_BARS).fill(0.12);
  let raf = 0;

  const animating = () =>
    view.state === 'recording' || view.state === 'processing' || (view.state === 'idle' && hovering);

  function startWave() {
    if (!raf && animating()) raf = requestAnimationFrame(drawWave);
  }

  function drawWave(time) {
    raf = 0;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) {
      if (animating()) raf = requestAnimationFrame(drawWave);
      return;
    }
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);

    const barWidth = 3;
    const gap = 3.5;
    const count = Math.max(5, Math.min(MAX_BARS, Math.floor((width + gap) / (barWidth + gap))));
    const startX = (width - (count * barWidth + (count - 1) * gap)) / 2;
    const live = view.state === 'recording' ? recorder.level() : 0;
    const command = view.mode === 'command';
    g.fillStyle = command ? '#f0d7ff' : view.state === 'processing' ? 'rgba(252,252,251,0.7)' : '#fcfcfb';

    for (let i = 0; i < count; i++) {
      const fromCenter = Math.abs(i - (count - 1) / 2) / ((count - 1) / 2);
      const shape = 0.3 + 0.7 * (1 - fromCenter * fromCenter);
      let target = 0.12;
      if (view.state === 'recording') {
        const jitter = 0.7 + 0.3 * Math.sin(time / 85 + i * 1.9) * Math.sin(time / 140 + i * 0.7);
        target = 0.12 + live * shape * jitter;
      } else if (view.state === 'processing') {
        target = 0.16 + 0.3 * (0.5 + 0.5 * Math.sin(time / 170 - i * 0.6));
      }
      heights[i] += (target - heights[i]) * 0.3;
      const h = Math.max(barWidth, heights[i] * (height - 10));
      g.beginPath();
      g.roundRect(startX + i * (barWidth + gap), (height - h) / 2, barWidth, h, barWidth / 2);
      g.fill();
    }
    if (animating()) raf = requestAnimationFrame(drawWave);
  }

  // ---------------------------------------------------------------------------
  // Messages from the main process
  // ---------------------------------------------------------------------------
  let soundsOn = true;

  flowBar.onState((next) => {
    const enteringHandsFree = next.state === 'recording' && next.mode === 'hands_free' && view.mode !== 'hands_free';
    view = { ...view, ...next, message: next.message };
    if (enteringHandsFree) {
      const hint = view.hint;
      showToast(() => kbdHint('Hands-free on. Tap ', hint, ' or click ■ to finish'), '', 2600);
    } else {
      render();
    }
  });

  flowBar.onRecord(async ({ action, requestId, deviceId, sounds }) => {
    try {
      if (action === 'start') {
        soundsOn = sounds !== false;
        await recorder.start({ deviceId });
        if (soundsOn) chimes.play('start');
        flowBar.reply({ requestId, ok: true });
      } else if (action === 'stop') {
        const result = await recorder.stop();
        if (soundsOn) chimes.play('stop');
        flowBar.reply({ requestId, ok: true, ...result });
      } else if (action === 'cancel') {
        recorder.cancel();
        flowBar.reply({ requestId, ok: true });
      }
    } catch (err) {
      recorder.cancel();
      flowBar.reply({ requestId, ok: false, error: microphoneError(err) });
    }
  });

  flowBar.onSound((name) => chimes.play(name));
  flowBar.onToast((message) => showToast(message, 'success'));
  flowBar.onPosition((position) => {
    stage.className = `stage ${position === 'top' ? 'top' : 'bottom'}`;
  });

  // ---------------------------------------------------------------------------
  // Pointer: the window ignores the mouse except over the pill.
  // ---------------------------------------------------------------------------
  pill.addEventListener('mouseenter', () => {
    hovering = true;
    flowBar.setInteractive(true);
    render();
  });
  pill.addEventListener('mouseleave', () => {
    hovering = false;
    flowBar.setInteractive(false);
    render();
  });
  pill.addEventListener('click', (event) => {
    if (event.target.closest('#stop')) return flowBar.action('stop');
    if (event.target.closest('#cancel')) return flowBar.action('cancel');
    if (view.state === 'idle') return flowBar.action(view.signedIn === false ? 'open-hub' : 'start');
    return undefined;
  });

  render();
})();
