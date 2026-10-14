// File: src/Referral/Referral.jsx
// "Get a free month": share your code; you both get a month of Pro.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, Gift, Mail } from 'lucide-react';
import { errorMessage, getReferrals, inviteReferral } from '../api/apiClient';
import { formatDate } from '../utils/formatter';
import EmptyState from '../components/ui/EmptyState';
import { PageSpinner } from '../components/ui/Spinner';

const STATUS = {
  invited: { label: 'Invited', className: 'bg-subtle text-muted' },
  signed_up: { label: 'Signed up', className: 'bg-dawn-300 text-dawn-800' },
  rewarded: { label: 'Free month earned', className: 'bg-fathom-50 text-fathom-900' },
};

export default function Referral() {
  const [data, setData] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    getReferrals()
      .then(setData)
      .catch((err) => toast.error(errorMessage(err)));
  }, []);

  if (!data) return <PageSpinner />;
  const link = `${window.location.origin}${data.invite_link}`;

  const copy = async (value, which) => {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      setData(await inviteReferral(email.trim()));
      toast.success(`Invite recorded — send ${email} your link`);
      setEmail('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Get a free month</h1>
      <p className="mt-1 text-sm text-muted">Give a friend a free month of Flow Pro — you&apos;ll get one too when they sign up.</p>

      <div className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-glow-100 via-signal-100 to-dawn-300 p-7 dark:from-vast-800 dark:via-vast-900 dark:to-vast-800">
        <Gift className="text-ink" />
        <p className="mt-3 font-display text-3xl text-ink">
          {data.rewarded_count} free month{data.rewarded_count === 1 ? '' : 's'} earned
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-panel/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your code</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-lg font-semibold tracking-wider text-ink">{data.referral_code}</span>
              <button className="btn-ghost px-2" onClick={() => copy(data.referral_code, 'code')} title="Copy code">
                {copied === 'code' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <div className="rounded-xl bg-panel/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Invite link</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="truncate text-sm text-ink">{link}</span>
              <button className="btn-ghost shrink-0 px-2" onClick={() => copy(link, 'link')} title="Copy link">
                {copied === 'link' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={invite} className="mt-6 flex gap-2">
        <input type="email" required className="input" placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={busy}>
          <Mail size={15} /> {busy ? 'Saving…' : 'Track invite'}
        </button>
      </form>

      <section className="mt-8">
        <p className="section-label mb-2">Past invites</p>
        {!data.referrals.length ? (
          <EmptyState icon={Mail} title="No invites yet" body="Share your link or code — your friend enters it when they create their account." />
        ) : (
          <div className="divide-y divide-line rounded-2xl border border-line bg-raised">
            {data.referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-ink">{r.name || r.email}</p>
                  <p className="text-xs text-muted">
                    {r.name ? `${r.email} · ` : ''}
                    {formatDate(r.created_at)}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status].className}`}>{STATUS[r.status].label}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
