// File: src/Settings/components/SystemSettings.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { errorMessage, restartOnboarding } from '../../api/apiClient';
import { useApp } from '../../context/AppContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Toggle from '../../components/ui/Toggle';
import SettingRow, { PrefToggle, SettingSection } from './SettingRow';

export default function SystemSettings() {
  const { preferences: prefs, savePreferences: save, isDesktop, setUser } = useApp();
  const navigate = useNavigate();
  const [signature, setSignature] = useState(prefs?.email_signature || '');
  const [confirmRestart, setConfirmRestart] = useState(false);
  if (!prefs) return null;

  const notif = prefs.notification_settings || {};
  const setNotif = (key, value) => save({ notification_settings: { [key]: value } });
  const desktopOnly = isDesktop ? undefined : 'Applies to the desktop app.';

  return (
    <div>
      <SettingSection title="App settings">
        <PrefToggle prefs={prefs} save={save} field="open_at_login" label="Launch app at login" description={desktopOnly} />
        <PrefToggle prefs={prefs} save={save} field="show_flow_bar" label="Show the Murmur bar at all times" description={desktopOnly || 'When off, the bar only appears while you dictate.'} />
        <PrefToggle prefs={prefs} save={save} field="show_in_taskbar" label="Show app in taskbar" description={desktopOnly} />
      </SettingSection>

      <SettingSection title="Sound">
        <PrefToggle prefs={prefs} save={save} field="enable_sounds" label="Dictation and notification sounds" />
        <PrefToggle prefs={prefs} save={save} field="mute_audio_while_dictating" label="Mute all audio while dictating" description={desktopOnly || 'Music and videos are muted while you speak.'} />
      </SettingSection>

      <SettingSection title="Extras">
        <PrefToggle prefs={prefs} save={save} field="auto_add_to_dictionary" label="Auto-add to dictionary" description="Adds corrected words automatically" />
        <PrefToggle prefs={prefs} save={save} field="command_mode_enabled" label="Command Mode" description="Select text, hold the command shortcut and say how to change it." />
        <PrefToggle prefs={prefs} save={save} field="email_auto_signature" label="Email auto signature" description="Adds your sign-off when you dictate an email." />
        {prefs.email_auto_signature && (
          <div className="px-5 py-4">
            <label className="label" htmlFor="signature">Signature</label>
            <textarea
              id="signature"
              className="input min-h-[70px]"
              placeholder={'Best,\nYour name'}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              onBlur={() => signature !== (prefs.email_signature || '') && save({ email_signature: signature.trim() || null }).then(() => toast.success('Signature saved'), () => {})}
            />
          </div>
        )}
      </SettingSection>

      <SettingSection title="Notifications">
        <SettingRow label="Suggestions" description="Tips about getting set up or improving how you use Murmur.">
          <NotifToggle value={notif.tips_and_suggestions} onChange={(v) => setNotif('tips_and_suggestions', v)} />
        </SettingRow>
        <SettingRow label="Announcements" description="New features or capabilities">
          <NotifToggle value={notif.feature_highlights} onChange={(v) => setNotif('feature_highlights', v)} />
        </SettingRow>
        <SettingRow label="Milestones" description="Word-count milestones and streaks">
          <NotifToggle value={notif.milestones_and_progress} onChange={(v) => setNotif('milestones_and_progress', v)} />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Data">
        <SettingRow label="Restart tutorial" description="Walk through the microphone, shortcut, and dictation setup steps again.">
          <button className="btn-secondary px-3 py-1.5" onClick={() => setConfirmRestart(true)}>
            Restart
          </button>
        </SettingRow>
      </SettingSection>

      <ConfirmModal
        isOpen={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        danger={false}
        confirmLabel="Restart tutorial"
        title="Restart tutorial?"
        message="You'll go through onboarding again. Your data and settings stay as they are."
        onConfirm={async () => {
          try {
            const res = await restartOnboarding();
            setUser(res.user);
            navigate('/onboarding');
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}

// Missing keys count as "on" (the backend default).
function NotifToggle({ value, onChange }) {
  return <Toggle checked={value !== false} onChange={onChange} />;
}
