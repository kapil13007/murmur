// File: src/hooks/useRecorder.js
// In-browser dictation recorder: microphone -> 16 kHz AudioWorklet -> WAV.
// Exposes a smoothed input level for the waveform animation.
import { useCallback, useEffect, useRef, useState } from 'react';
import { encodeWav, rms } from '../utils/audio/wavEncoder';

const SAMPLE_RATE = 16000;

export function useRecorder({ deviceId } = {}) {
  const [state, setState] = useState('idle'); // idle | starting | recording
  const [level, setLevel] = useState(0);
  const [error, setError] = useState(null);
  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const nodeRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);

  const cleanup = useCallback(() => {
    nodeRef.current?.port?.close?.();
    nodeRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    nodeRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    setError(null);
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          channelCount: 1,
          noiseSuppression: true,
          autoGainControl: true,
          echoCancellation: false,
        },
      });
      // Chromium resamples the microphone to the context rate for us.
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      await ctx.audioWorklet.addModule('/recorder-worklet.js');
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'recorder-processor');
      chunksRef.current = [];
      node.port.onmessage = (e) => {
        chunksRef.current.push(e.data);
        setLevel((prev) => prev * 0.6 + Math.min(1, rms(e.data) * 6) * 0.4);
      };
      source.connect(node);
      streamRef.current = stream;
      ctxRef.current = ctx;
      nodeRef.current = node;
      startedAtRef.current = performance.now();
      setState('recording');
    } catch (err) {
      cleanup();
      setState('idle');
      const message =
        err?.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in your browser settings.'
          : err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError'
            ? 'No microphone was found. Check the device in Settings > General.'
            : `Could not start the microphone: ${err?.message || err}`;
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, [state, deviceId, cleanup]);

  // Resolves to { blob, duration } (or null if nothing was recorded).
  const stop = useCallback(async () => {
    if (state !== 'recording') return null;
    // Let the worklet flush its last partial batch.
    await new Promise((r) => setTimeout(r, 120));
    const chunks = chunksRef.current;
    const duration = (performance.now() - startedAtRef.current) / 1000;
    cleanup();
    setState('idle');
    if (!chunks.length) return null;
    return { blob: encodeWav(chunks, SAMPLE_RATE), duration };
  }, [state, cleanup]);

  const cancel = useCallback(() => {
    chunksRef.current = [];
    cleanup();
    setState('idle');
  }, [cleanup]);

  return { state, isRecording: state === 'recording', level, error, start, stop, cancel };
}
