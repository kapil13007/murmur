// File: src/components/ui/Waveform.jsx
// Live microphone bars driven by the recorder's input level.
import clsx from 'clsx';

const SHAPE = [0.35, 0.6, 0.85, 1, 0.75, 0.55, 0.9, 0.65, 0.4];

export default function Waveform({ level = 0, active = true, className, barClass = 'bg-current' }) {
  return (
    <span className={clsx('inline-flex h-5 items-center gap-[3px]', className)} aria-hidden>
      {SHAPE.map((s, i) => {
        const h = active ? Math.max(0.18, Math.min(1, level * 1.6 * s + 0.12)) : 0.18;
        return (
          <span
            key={i}
            className={clsx('w-[3px] rounded-full transition-[height] duration-75', barClass)}
            style={{ height: `${Math.round(h * 100)}%` }}
          />
        );
      })}
    </span>
  );
}
