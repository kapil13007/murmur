// File: src/Onboarding/components/ChipGroup.jsx
import { Check } from 'lucide-react';
import clsx from 'clsx';

export default function ChipGroup({ options, value, onChange, single = false }) {
  const toggle = (id) => {
    if (single) return onChange([id]);
    return onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([id, label]) => {
        const active = value.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(id)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition',
              active ? 'border-ink bg-ink text-panel' : 'border-line bg-panel text-ink hover:border-vast-300',
            )}
          >
            {active && <Check size={14} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
