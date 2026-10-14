// File: src/Transforms/components/Playground.jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDown, Check, Copy, CornerDownLeft, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { applyTransform, errorMessage } from '../../api/apiClient';
import DictateButton from '../../components/DictateButton';

const SAMPLE = 'so um basically i think we should push the launch to friday because the the qa team found a couple of bugs and also marketing needs more time';

export default function Playground({ transforms, onRun }) {
  const [text, setText] = useState(SAMPLE);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const run = async (payload, key) => {
    if (!text.trim()) return;
    setBusy(key);
    try {
      const res = await applyTransform({ text, ...payload, app_name: 'Whisper Flow Hub' });
      setResult(res);
      if (res.status === 'no_changes') toast('No changes made');
      onRun();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(result.output_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="mt-8 rounded-2xl border border-line bg-raised p-5">
      <div className="flex items-center justify-between">
        <p className="section-label">Try a transform</p>
        <DictateButton onText={(t) => setText(t)} appName="Transforms" />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input mt-3 min-h-[110px] resize-y text-[15px] leading-relaxed"
        placeholder="Paste or dictate some text…"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {transforms.map((t) => (
          <button
            key={t.id}
            onClick={() => run({ transform_id: t.id }, t.id)}
            disabled={Boolean(busy) || !text.trim()}
            className={clsx('btn-secondary px-3 py-1.5 text-[13px]', busy === t.id && 'opacity-70')}
          >
            {busy === t.id && <Loader2 size={13} className="animate-spin" />}
            {t.name}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (instruction.trim()) run({ instruction: instruction.trim() }, 'custom');
        }}
      >
        <input className="input" placeholder='Or type an instruction, e.g. "make it sound more confident"' value={instruction} onChange={(e) => setInstruction(e.target.value)} />
        <button type="submit" className="btn-primary shrink-0" disabled={Boolean(busy) || !instruction.trim() || !text.trim()}>
          {busy === 'custom' ? <Loader2 size={15} className="animate-spin" /> : <CornerDownLeft size={15} />} Apply
        </button>
      </form>

      {result && (
        <div className="mt-5 animate-pop-in">
          <div className="mb-2 flex items-center justify-center text-faint">
            <ArrowDown size={16} />
          </div>
          <div className="rounded-xl border border-line bg-panel p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                {result.transform_name || 'Custom instruction'} · {result.provider === 'rules' ? 'built-in engine' : `${result.provider} · ${result.model}`} ·{' '}
                {result.input_word_count} → {result.output_word_count} words
              </p>
              <div className="flex gap-1">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setText(result.output_text)}>
                  Use as input
                </button>
                <button className="btn-ghost px-2 py-1" onClick={copy} title="Copy">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{result.output_text}</p>
          </div>
        </div>
      )}
    </section>
  );
}
