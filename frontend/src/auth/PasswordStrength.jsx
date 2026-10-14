// File: src/auth/PasswordStrength.jsx
import clsx from 'clsx';

function passwordScore(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = ['bg-flare-400', 'bg-flare-400', 'bg-glow-300', 'bg-fathom-500', 'bg-fathom-800'];

export default function PasswordStrength({ password }) {
  if (!password) return null;
  const score = passwordScore(password);
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={clsx('h-1 flex-1 rounded-full', i < score ? COLORS[score] : 'bg-subtle')} />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">{LABELS[score]} · use 8+ characters with letters and numbers</p>
    </div>
  );
}
