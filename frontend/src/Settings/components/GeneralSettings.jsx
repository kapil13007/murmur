// File: src/Settings/components/GeneralSettings.jsx
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { describeLanguages } from '../../utils/languages';
import KeyCombo from '../../components/ui/KeyCombo';
import LanguagesDialog from './LanguagesDialog';
import MicrophoneDialog from './MicrophoneDialog';
import SettingRow, { SettingSection } from './SettingRow';
import ShortcutsDialog from './ShortcutsDialog';

export default function GeneralSettings() {
  const { preferences: prefs, savePreferences } = useApp();
  const [dialog, setDialog] = useState(null);
  if (!prefs) return null;

  return (
    <div>
      <SettingSection>
        <SettingRow
          label="Shortcuts"
          description={
            <span className="inline-flex flex-wrap items-center gap-1">
              Hold <KeyCombo keys={prefs.shortcuts.push_to_talk} /> and speak.
            </span>
          }
        >
          <button className="btn-secondary px-3 py-1.5" onClick={() => setDialog('shortcuts')}>
            Change
          </button>
        </SettingRow>
        <SettingRow label="Microphone" description={prefs.microphone_label || 'Auto-detect (system default)'}>
          <button className="btn-secondary px-3 py-1.5" onClick={() => setDialog('microphone')}>
            Change
          </button>
        </SettingRow>
        <SettingRow label="Languages" description={describeLanguages(prefs.selected_languages)}>
          <button className="btn-secondary px-3 py-1.5" onClick={() => setDialog('languages')}>
            Change
          </button>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Appearance">
        <SettingRow label="Theme" description="Light, dark, or follow your system.">
          <select className="input w-36 py-1.5" value={prefs.theme} onChange={(e) => savePreferences({ theme: e.target.value })}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </SettingRow>
        <SettingRow label="App Language" description="Select your preferred Murmur language">
          <select className="input w-36 py-1.5" value="en" disabled>
            <option value="en">English</option>
          </select>
        </SettingRow>
        <SettingRow label="Time zone" description="Used for streaks and daily stats.">
          <span className="text-sm text-muted">{prefs.timezone}</span>
        </SettingRow>
      </SettingSection>

      {dialog === 'shortcuts' && <ShortcutsDialog onClose={() => setDialog(null)} />}
      {dialog === 'microphone' && <MicrophoneDialog onClose={() => setDialog(null)} />}
      {dialog === 'languages' && <LanguagesDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
