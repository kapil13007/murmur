// File: src/auth/LoginPage.jsx
import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { errorMessage, login } from '../api/apiClient';
import { useApp } from '../context/AppContext';
import { isDesktop } from '../desktop/bridge';
import AuthLayout from './AuthLayout';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { refresh } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('expired') ? 'Your session expired. Please sign in again.' : '');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password, remember || isDesktop);
      const me = await refresh();
      toast.success(`Welcome back, ${me.user.first_name}!`);
      const from = location.state?.from?.pathname;
      navigate(me.user.onboarding_completed ? from || '/' : '/onboarding', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Incorrect email or password'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to keep your dictionary, snippets and history in sync."
      footer={
        <>
          New to Flow?{' '}
          <Link to="/register" className="font-semibold text-ink underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {!isDesktop && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-vast-950" />
            Keep me signed in for 30 days
          </label>
        )}
        {error && <p className="rounded-xl bg-flare-50 px-3 py-2 text-sm text-flare-600 dark:bg-flare-600/20 dark:text-flare-200">{error}</p>}
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
