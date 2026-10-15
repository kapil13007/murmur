// File: src/Dictionary/components/DictionaryBanner.jsx
const EXAMPLES = ['Kubernetes', 'Q3 OKRs', 'Prem', 'Supabase', 'ChatGPT', 'GitHub'];

export default function DictionaryBanner() {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-r from-fathom-50 to-dawn-200 px-7 py-6 dark:from-fathom-950 dark:to-vast-900">
      <p className="font-display text-[26px] leading-tight text-ink">Murmur speaks the way you speak.</p>
      <p className="mt-1.5 max-w-xl text-sm text-muted">
        Add names, acronyms and jargon Murmur should always spell your way. When you fix a word in a transcript, Murmur adds it
        here automatically.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((w) => (
          <span key={w} className="rounded-full border border-line bg-panel/80 px-3 py-1 text-sm text-ink">
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}
