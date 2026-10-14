// File: src/Settings/components/SettingRow.jsx
import Toggle from '../../components/ui/Toggle';

export function SettingSection({ title, children }) {
  return (
    <section className="mt-6">
      {title && <p className="section-label mb-2">{title}</p>}
      <div className="divide-y divide-line rounded-2xl border border-line">{children}</div>
    </section>
  );
}

export default function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// A preference toggle bound straight to the user's preferences.
export function PrefToggle({ prefs, save, field, label, description, disabled }) {
  return (
    <SettingRow label={label} description={description}>
      <Toggle checked={Boolean(prefs[field])} onChange={(v) => save({ [field]: v })} disabled={disabled} label={label} />
    </SettingRow>
  );
}
