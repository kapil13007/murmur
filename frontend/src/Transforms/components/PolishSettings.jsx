// File: src/Transforms/components/PolishSettings.jsx
// What "Polish" does (Wispr's polishInstructions toggles).
import { useApp } from '../../context/AppContext';

const OPTIONS = [
  ['make_more_concise', 'Make more concise'],
  ['clarify_main_point', 'Clarify main point'],
  ['maintain_your_tone', 'Maintain your tone'],
  ['reword_for_clarity', 'Reword for clarity'],
  ['reorder_for_readability', 'Reorder for readability'],
  ['refine_phrasing_for_impact', 'Refine phrasing for impact'],
  ['add_structure_for_readability', 'Add structure for readability'],
];

export default function PolishSettings() {
  const { preferences, savePreferences } = useApp();
  if (!preferences) return null;
  const values = preferences.polish_instructions || {};
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-ink">Polish settings</h2>
      <p className="mt-1 text-sm text-muted">Choose what the Polish transform does to your writing.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {OPTIONS.map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 hover:bg-subtle/60">
            <input
              type="checkbox"
              className="h-4 w-4 accent-vast-950"
              checked={Boolean(values[key])}
              onChange={(e) => savePreferences({ polish_instructions: { [key]: e.target.checked } })}
            />
            <span className="text-sm text-ink">{label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
