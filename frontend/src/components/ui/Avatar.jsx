// File: src/components/ui/Avatar.jsx
import clsx from 'clsx';
import { initials } from '../../utils/formatter';

const COLORS = ['bg-dawn-500 text-dawn-900', 'bg-fathom-100 text-fathom-950', 'bg-glow-100 text-glow-500', 'bg-signal-300 text-signal-800', 'bg-chord-200 text-chord-700'];

export default function Avatar({ name = '', src, size = 32, className }) {
  const color = COLORS[(name.charCodeAt(0) || 0) % COLORS.length];
  return src ? (
    <img src={src} alt={name} style={{ width: size, height: size }} className={clsx('rounded-full object-cover', className)} />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      className={clsx('inline-flex items-center justify-center rounded-full font-semibold', color, className)}
    >
      {initials(name)}
    </span>
  );
}
