// File: src/Style/components/StyleCard.jsx
import { Check } from 'lucide-react';
import clsx from 'clsx';

function ChatPreview({ text, app }) {
  return (
    <div className="flex items-end gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fathom-100 text-xs font-semibold text-fathom-950">M</span>
      <div>
        <p className="mb-1 text-[11px] text-faint">{app}</p>
        <p className={clsx('max-w-[260px] whitespace-pre-wrap rounded-2xl rounded-bl-md px-3.5 py-2 text-[13.5px] leading-snug', app === 'Slack' ? 'bg-panel text-ink shadow-panel' : 'bg-fathom-800 text-white')}>
          {text}
        </p>
      </div>
    </div>
  );
}

function EmailPreview({ text }) {
  return (
    <div className="rounded-xl bg-panel p-3 text-[13px] shadow-panel">
      <p className="border-b border-line pb-1.5 text-[11px] text-faint">To: alex@company.com · Re: Today&apos;s chat</p>
      <p className="mt-2 whitespace-pre-wrap leading-snug text-ink">{text}</p>
    </div>
  );
}

function DocPreview({ text }) {
  return <p className="whitespace-pre-wrap rounded-xl bg-panel p-3 text-[13.5px] leading-snug text-ink shadow-panel">{text}</p>;
}

export default function StyleCard({ category, example, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={clsx(
        'relative flex flex-col rounded-2xl border p-5 text-left transition',
        selected ? 'border-ink bg-raised ring-1 ring-ink' : 'border-line bg-raised hover:border-vast-300',
      )}
    >
      {selected && (
        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary">
          <Check size={14} />
        </span>
      )}
      <p className={clsx('font-display text-[28px] leading-none text-ink', example.style === 'very_casual' && 'lowercase')}>{example.title}</p>
      <p className="mt-1.5 text-sm text-muted">{example.subtitle}</p>
      <div className="mt-5 flex-1 rounded-xl bg-subtle p-3.5">
        {category === 'email' ? (
          <EmailPreview text={example.example} />
        ) : category === 'other' ? (
          <DocPreview text={example.example} />
        ) : (
          <ChatPreview text={example.example} app={category === 'work' ? 'Slack' : 'Messages'} />
        )}
      </div>
    </button>
  );
}
