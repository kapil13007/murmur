// File: src/components/ui/SearchInput.jsx
import { Search, X } from 'lucide-react';
import clsx from 'clsx';

export default function SearchInput({ value, onChange, placeholder = 'Search', className }) {
  return (
    <label className={clsx('relative flex items-center', className)}>
      <Search size={15} className="pointer-events-none absolute left-3 text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input py-2 pl-9 pr-8"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2.5 text-faint hover:text-ink" aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </label>
  );
}
