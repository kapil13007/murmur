// File: src/Settings/components/MicrophoneDialog.jsx
// Pick the dictation microphone with a live input-level test.
import { useEffect, useRef, useState } from 'react';
import { Check, Mic } from 'lucide-react';
import clsx from 'clsx';
import { useApp } from '../../context/AppContext';
import Modal from '../../components/ui/Modal';

function useLevel(deviceId) {
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const raf = useRef(0);

  useEffect(() => {
    let stream;
    let ctx;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += v * v;
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 8));
          raf.current = requestAnimationFrame(tick);
        };
        tick();
        setError('');
      } catch (err) {
        setError(err?.name === 'NotAllowedError' ? 'Microphone access is blocked.' : 'This microphone is unavailable.');
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf.current);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
  }, [deviceId]);

  return { level, error };
}

export default function MicrophoneDialog({ onClose }) {
  const { preferences, savePreferences } = useApp();
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(preferences.microphone_device_id || '');
  const { level, error } = useLevel(selected);

  useEffect(() => {
    // Labels are only exposed after permission, which useLevel requests.
    const refresh = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((all) => setDevices(all.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications')))
        .catch(() => {});
    refresh();
    const t = setTimeout(refresh, 800);
    navigator.mediaDevices.addEventListener?.('devicechange', refresh);
    return () => {
      clearTimeout(t);
      navigator.mediaDevices.removeEventListener?.('devicechange', refresh);
    };
  }, []);

  const choose = (device) => {
    setSelected(device ? device.deviceId : '');
    savePreferences({
      microphone_device_id: device ? device.deviceId : null,
      microphone_label: device ? device.label || 'Microphone' : null,
    });
  };

  const options = [{ deviceId: '', label: 'Auto-detect (system default)' }, ...devices];

  return (
    <Modal isOpen onClose={onClose} title="Microphone" subtitle="Used for dictation. Speak to test the level." size="lg">
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-subtle px-4 py-3">
        <Mic size={16} className="text-muted" />
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel">
          <div className={clsx('h-full rounded-full transition-[width] duration-75', level > 0.6 ? 'bg-glow-300' : 'bg-fathom-600')} style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
        {error && <span className="text-xs text-flare-500">{error}</span>}
      </div>
      <div className="max-h-72 divide-y divide-line overflow-y-auto rounded-2xl border border-line">
        {options.map((d) => (
          <button key={d.deviceId || 'auto'} onClick={() => choose(d.deviceId ? d : null)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-subtle/60">
            <span className="text-sm text-ink">{d.label || 'Microphone'}</span>
            {selected === d.deviceId && <Check size={16} className="text-ink" />}
          </button>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
