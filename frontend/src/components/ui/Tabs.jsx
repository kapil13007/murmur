// File: src/components/ui/Tabs.jsx
import clsx from 'clsx';

export default function Tabs({ tabs, value, onChange, className }) {
  return (
    <div role="tablist" className={clsx('flex flex-wrap items-center gap-1 border-b border-line', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition',
            value === tab.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {tab.label}
          {tab.count !== undefined && <span className="ml-1.5 text-xs text-faint">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
