// File: src/auth/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { errorMessage, register } from '../api/apiClient';
import { useApp } from '../context/AppContext';
import AuthLayout from './AuthLayout';
import PasswordStrength from './PasswordStrength';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useApp();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(form);
      await refresh();
      toast.success('Account created. Welcome to Murmur!');
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Your personal voice-to-text, on your own server."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-ink underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="first_name">First name</label>
            <input id="first_name" required autoComplete="given-name" className="input" value={form.first_name} onChange={set('first_name')} />
          </div>
          <div>
            <label className="label" htmlFor="last_name">Last name</label>
            <input id="last_name" autoComplete="family-name" className="input" value={form.last_name} onChange={set('last_name')} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required autoComplete="new-password" className="input" value={form.password} onChange={set('password')} />
          <PasswordStrength password={form.password} />
        </div>
        {error && <p className="rounded-xl bg-flare-50 px-3 py-2 text-sm text-flare-600 dark:bg-flare-600/20 dark:text-flare-200">{error}</p>}
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-center text-xs text-faint">Your audio is processed by your own Murmur server.</p>
      </form>
    </AuthLayout>
  );
}
