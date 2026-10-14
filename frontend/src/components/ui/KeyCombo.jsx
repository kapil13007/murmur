// File: src/components/ui/KeyCombo.jsx
// Renders a shortcut as keycaps: [Ctrl] [Win].
import clsx from 'clsx';
import { sortKeys } from '../../utils/shortcuts';

const LABELS = { Win: '⊞ Win', Space: 'Space', Esc: 'Esc' };

export default function KeyCombo({ keys, className, size = 'md' }) {
  if (!keys || !keys.length) return <span className="text-sm text-faint">Not set</span>;
  return (
    <span className={clsx('inline-flex items-center gap-1', className)}>
      {sortKeys(keys).map((k) => (
        <kbd key={k} className={clsx('kbd', size === 'lg' && 'min-w-[2.5rem] px-2.5 py-1 text-sm')}>
          {LABELS[k] || k}
        </kbd>
      ))}
    </span>
  );
}
