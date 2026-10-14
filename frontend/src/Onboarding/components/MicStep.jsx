// File: src/Onboarding/components/MicStep.jsx
// Live microphone level + device picker.
import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Waveform from '../../components/ui/Waveform';

export default function MicStep() {
  const { preferences, savePreferences } = useApp();
  const [level, setLevel] = useState(0);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState('');
  const raf = useRef(0);
  const deviceId = preferences?.microphone_device_id || '';

  useEffect(() => {
    let stream;
    let ctx;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === 'audioinput' && !['default', 'communications'].includes(d.deviceId)));
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
        setError(err?.name === 'NotAllowedError' ? 'Microphone access is blocked. Allow it and reload.' : 'No microphone found.');
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf.current);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
  }, [deviceId]);

  return (
    <div>
      <div className="flex items-center gap-5 rounded-2xl border border-line bg-panel px-6 py-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-vast-950 text-sand-50">
          <Mic />
        </span>
        <Waveform level={level} className="h-10 flex-1 justify-center text-fathom-700 [&>span]:w-[5px]" />
      </div>
      {error && <p className="mt-3 text-sm text-flare-500">{error}</p>}
      <label className="label mt-5" htmlFor="mic-select">Microphone</label>
      <select
        id="mic-select"
        className="input"
        value={deviceId}
        onChange={(e) => {
          const d = devices.find((x) => x.deviceId === e.target.value);
          savePreferences({ microphone_device_id: d ? d.deviceId : null, microphone_label: d ? d.label : null });
        }}
      >
        <option value="">Auto-detect (system default)</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || 'Microphone'}
          </option>
        ))}
      </select>
    </div>
  );
}
