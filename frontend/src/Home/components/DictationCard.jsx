// File: src/Home/components/DictationCard.jsx
// In the desktop app this explains the global shortcuts. In a browser it
// records right here: click the mic, speak, click again — the text comes
// back cleaned up exactly as the desktop app would paste it.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, Loader2, Mic, Square, X } from 'lucide-react';
import clsx from 'clsx';
import { errorMessage, transcribeAudio } from '../../api/apiClient';
import { useApp } from '../../context/AppContext';
import { useRecorder } from '../../hooks/useRecorder';
import KeyCombo from '../../components/ui/KeyCombo';
import Waveform from '../../components/ui/Waveform';

function DesktopHint({ shortcuts }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-vast-950 px-7 py-6 text-sand-50">
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-dawn-600/30 blur-3xl" />
      <p className="font-display text-2xl">Dictate in any app</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-vast-200">
        Hold <KeyCombo keys={shortcuts?.push_to_talk} className="[&_kbd]:border-vast-700 [&_kbd]:bg-vast-900 [&_kbd]:text-sand-50" /> and speak.
        Release to paste.
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-vast-300">
        Hands-free: <KeyCombo keys={shortcuts?.hands_free} className="[&_kbd]:border-vast-700 [&_kbd]:bg-vast-900 [&_kbd]:text-sand-50" />
        <span className="mx-1 text-vast-600">·</span>
        Command Mode: <KeyCombo keys={shortcuts?.command_mode} className="[&_kbd]:border-vast-700 [&_kbd]:bg-vast-900 [&_kbd]:text-sand-50" />
      </div>
    </div>
  );
}

export default function DictationCard({ onDictated }) {
  const { preferences, isDesktop } = useApp();
  const recorder = useRecorder({ deviceId: preferences?.microphone_device_id || undefined });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  if (isDesktop) return <DesktopHint shortcuts={preferences?.shortcuts} />;

  const toggle = async () => {
    if (recorder.isRecording) {
      const recording = await recorder.stop();
      if (!recording || recording.duration < 0.3) {
        toast('That was too short — hold on and speak a little longer.');
        return;
      }
      setProcessing(true);
      try {
        const res = await transcribeAudio(recording.blob, {
          mode: 'web',
          app_name: 'Murmur',
          timezone_offset_minutes: -new Date().getTimezoneOffset(),
        });
        if (res.status !== 'success') toast(res.message || 'No speech detected');
        setResult(res);
        onDictated?.();
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setProcessing(false);
      }
    } else {
      setResult(null);
      await recorder.start().catch((err) => toast.error(err.message));
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-dawn-200 via-sand-50 to-fathom-50 dark:from-vast-900 dark:via-vast-900 dark:to-vast-800">
      <div className="flex items-center gap-5 px-6 py-5">
        <button
          onClick={toggle}
          disabled={processing || recorder.state === 'starting'}
          aria-label={recorder.isRecording ? 'Stop dictating' : 'Start dictating'}
          className={clsx(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-pop transition',
            recorder.isRecording ? 'bg-flare-400 text-white' : 'bg-vast-950 text-sand-50 hover:scale-105',
          )}
        >
          {processing ? <Loader2 className="animate-spin" /> : recorder.isRecording ? <Square size={18} fill="currentColor" /> : <Mic />}
        </button>
        <div className="min-w-0 flex-1">
          {recorder.isRecording ? (
            <div className="flex items-center gap-3">
              <Waveform level={recorder.level} className="text-ink" />
              <span className="text-sm font-medium text-ink">Listening… click to finish</span>
              <button onClick={recorder.cancel} className="ml-auto rounded-lg p-1 text-muted hover:text-ink" aria-label="Cancel">
                <X size={16} />
              </button>
            </div>
          ) : processing ? (
            <p className="text-sm font-medium text-ink">Cleaning up your words…</p>
          ) : (
            <>
              <p className="font-display text-2xl text-ink">Try dictating</p>
              <p className="text-sm text-muted">
                Click the mic and speak naturally — fillers, self-corrections and formatting are handled for you.
                Install the desktop app to dictate into any app with <KeyCombo keys={preferences?.shortcuts?.push_to_talk} />.
              </p>
            </>
          )}
        </div>
      </div>
      {result?.status === 'success' && (
        <div className="border-t border-line bg-panel/70 px-6 py-4">
          <div className="flex items-start gap-3">
            <p className="flex-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{result.text}</p>
            <button onClick={copy} className="btn-ghost px-2 py-1" title="Copy">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="mt-2 text-xs text-faint">
            {result.transcript.num_words} words · {(result.timings.total_ms / 1000).toFixed(1)}s ·{' '}
            {result.transcript.formatter === 'rules' ? 'built-in cleanup' : `AI cleanup (${result.transcript.formatter})`}
          </p>
        </div>
      )}
    </div>
  );
}
