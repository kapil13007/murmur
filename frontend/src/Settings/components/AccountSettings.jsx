// File: src/Settings/components/AccountSettings.jsx
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Laptop, LogOut, Trash2 } from 'lucide-react';
import {
  changePassword,
  deleteAccount,
  errorMessage,
  getDevices,
  logout,
  logoutEverywhere,
  removeDevice,
  updateProfile,
} from '../../api/apiClient';
import { useApp } from '../../context/AppContext';
import { relativeTime } from '../../utils/formatter';
import Avatar from '../../components/ui/Avatar';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PasswordStrength from '../../auth/PasswordStrength';
import { SettingSection } from './SettingRow';

// Downscale an uploaded photo to a 160px square data URL.
function toAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 160;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const side = Math.min(img.width, img.height);
      canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function AccountSettings() {
  const { user, setUser } = useApp();
  const [profile, setProfile] = useState({ first_name: user.first_name, last_name: user.last_name || '' });
  const [passwords, setPasswords] = useState({ old_password: '', new_password: '' });
  const [devices, setDevices] = useState([]);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    getDevices().then(setDevices).catch(() => {});
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await updateProfile({ first_name: profile.first_name.trim(), last_name: profile.last_name.trim() || null });
      setUser(res.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    try {
      const res = await updateProfile({ avatar_url: await toAvatarDataUrl(file) });
      setUser(res.user);
      toast.success('Photo updated');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not use that image'));
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await changePassword(passwords);
      toast.success(res.message);
      setPasswords({ old_password: '', new_password: '' });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={user.full_name} src={user.avatar_url} size={64} />
        <div>
          <p className="font-semibold text-ink">{user.full_name}</p>
          <p className="text-sm text-muted">{user.email}</p>
          <div className="mt-1.5 flex gap-2">
            <button className="btn-secondary px-3 py-1 text-xs" onClick={() => fileRef.current?.click()}>
              Upload photo
            </button>
            {user.avatar_url && (
              <button
                className="btn-ghost px-2 py-1 text-xs"
                onClick={async () => setUser((await updateProfile({ avatar_url: null })).user)}
              >
                Remove
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
        </div>
      </div>

      <SettingSection title="Profile">
        <form onSubmit={saveProfile} className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="first">First name</label>
            <input id="first" className="input" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="last">Last name</label>
            <input id="last" className="input" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} />
          </div>
          <button className="btn-primary" type="submit">
            Save
          </button>
        </form>
      </SettingSection>

      <SettingSection title="Password">
        <form onSubmit={submitPassword} className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
          <div>
            <label className="label" htmlFor="old">Current password</label>
            <input id="old" type="password" autoComplete="current-password" className="input" value={passwords.old_password} onChange={(e) => setPasswords({ ...passwords, old_password: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="new">New password</label>
            <input id="new" type="password" autoComplete="new-password" className="input" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} required />
            <PasswordStrength password={passwords.new_password} />
          </div>
          <button className="btn-primary sm:mt-[22px]" type="submit">
            Update
          </button>
        </form>
      </SettingSection>

      <SettingSection title="Devices">
        {devices.length ? (
          devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-5 py-3.5">
              <Laptop size={18} className="text-muted" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{d.device_name || d.platform}</p>
                <p className="text-xs text-muted">
                  {d.platform} {d.arch} · v{d.app_version || '?'} · active {relativeTime(d.last_seen_at)}
                </p>
              </div>
              <button
                className="btn-ghost px-2 py-1 text-xs"
                onClick={async () => {
                  await removeDevice(d.id);
                  setDevices(devices.filter((x) => x.id !== d.id));
                }}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="px-5 py-4 text-sm text-muted">No desktop devices yet. Sign in from the Whisper Flow desktop app to register one.</p>
        )}
      </SettingSection>

      <SettingSection title="Session">
        <div className="flex flex-wrap gap-2 p-5">
          <button className="btn-secondary" onClick={logout}>
            <LogOut size={15} /> Log out
          </button>
          <button className="btn-secondary" onClick={() => setConfirmLogoutAll(true)}>
            Log out of all devices
          </button>
          <button className="btn-ghost ml-auto text-flare-500 hover:bg-flare-50 hover:text-flare-600 dark:hover:bg-flare-600/20" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} /> Delete account
          </button>
        </div>
      </SettingSection>

      <ConfirmModal
        isOpen={confirmLogoutAll}
        onClose={() => setConfirmLogoutAll(false)}
        danger={false}
        confirmLabel="Log out everywhere"
        title="Log out of all devices?"
        message="Every browser and desktop app signed in to your account will need to sign in again, including this one."
        onConfirm={async () => {
          await logoutEverywhere();
          logout();
        }}
      />
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        confirmLabel="Delete my account"
        title="Delete your account?"
        message="This permanently deletes your transcripts, dictionary, snippets, notes and settings. This can't be undone."
        onConfirm={async () => {
          await deleteAccount(deletePassword);
          toast.success('Account deleted');
          logout();
        }}
      >
        <input type="password" className="input mt-4" placeholder="Enter your password to confirm" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
      </ConfirmModal>
    </div>
  );
}
