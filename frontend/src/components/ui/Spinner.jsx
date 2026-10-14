// File: src/components/ui/Spinner.jsx
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

export default function Spinner({ size = 18, className, label }) {
  return (
    <span className={clsx('inline-flex items-center gap-2 text-muted', className)} role="status">
      <Loader2 size={size} className="animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}

export function PageSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner label="Loading…" />
    </div>
  );
}
