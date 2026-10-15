// File: src/components/DictateButton.jsx
// Mic button that records, sends the audio through the dictation pipeline
// and hands back the cleaned-up text.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Mic, Square } from 'lucide-react';
import clsx from 'clsx';
import { errorMessage, transcribeAudio } from '../api/apiClient';
import { useApp } from '../context/AppContext';
import { useRecorder } from '../hooks/useRecorder';
import Waveform from './ui/Waveform';

export default function DictateButton({ onText, appName = 'Murmur', compact = false }) {
  const { preferences } = useApp();
  const recorder = useRecorder({ deviceId: preferences?.microphone_device_id || undefined });
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!recorder.isRecording) {
      await recorder.start().catch((err) => toast.error(err.message));
      return;
    }
    const recording = await recorder.stop();
    if (!recording || recording.duration < 0.3) return;
    setBusy(true);
    try {
      const res = await transcribeAudio(recording.blob, { mode: 'web', app_name: appName });
      if (res.status === 'success') onText(res.text);
      else toast(res.message || 'No speech detected');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || recorder.state === 'starting'}
      className={clsx(
        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-60',
        recorder.isRecording ? 'bg-flare-400 text-white' : 'bg-vast-950 text-sand-50 hover:opacity-90 dark:bg-sand-50 dark:text-vast-950',
      )}
      title={recorder.isRecording ? 'Stop and insert' : 'Dictate'}
    >
      {busy ? (
        <Loader2 size={15} className="animate-spin" />
      ) : recorder.isRecording ? (
        <>
          <Square size={12} fill="currentColor" />
          <Waveform level={recorder.level} className="h-4" />
        </>
      ) : (
        <Mic size={15} />
      )}
      {!compact && (busy ? 'Transcribing…' : recorder.isRecording ? 'Stop' : 'Dictate')}
    </button>
  );
}
