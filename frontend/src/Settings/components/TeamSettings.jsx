// File: src/Settings/components/TeamSettings.jsx
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, RefreshCw, UserMinus } from 'lucide-react';
import * as api from '../../api/apiClient';
import { useApp } from '../../context/AppContext';
import { relativeTime } from '../../utils/formatter';
import Avatar from '../../components/ui/Avatar';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { PageSpinner } from '../../components/ui/Spinner';
import { SettingSection } from './SettingRow';

export default function TeamSettings() {
  const { user, setHasTeam } = useApp();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [emails, setEmails] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const apply = useCallback(
    (res) => {
      setData(res);
      setHasTeam(Boolean(res.team));
      if (res.team) setName(res.team.name);
    },
    [setHasTeam],
  );

  useEffect(() => {
    api.getMyTeam().then(apply).catch((err) => toast.error(api.errorMessage(err)));
  }, [apply]);

  const run = async (fn, success) => {
    try {
      apply(await fn());
      if (success) toast.success(success);
    } catch (err) {
      toast.error(api.errorMessage(err));
    }
  };

  if (!data) return <PageSpinner />;
  const { team, invitations } = data;
  const isAdmin = team?.my_role === 'admin';

  if (!team) {
    return (
      <div>
        <p className="mt-2 text-sm text-muted">Teams share a dictionary and snippets, so everyone&apos;s dictation spells your product names, customers and jargon the same way.</p>
        {invitations.length > 0 && (
          <SettingSection title="Invitations">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-ink">{inv.team_name}</p>
                  <p className="text-xs text-muted">Invited by {inv.invited_by || 'a teammate'} · {relativeTime(inv.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary px-3 py-1.5" onClick={() => run(() => api.declineInvitation(inv.id), 'Invitation declined')}>
                    Decline
                  </button>
                  <button className="btn-primary px-3 py-1.5" onClick={() => run(() => api.acceptInvitation(inv.id), `Joined ${inv.team_name}`)}>
                    Accept invite
                  </button>
                </div>
              </div>
            ))}
          </SettingSection>
        )}
        <SettingSection title="Create a team">
          <form
            className="flex gap-2 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api.createTeam(name.trim()), 'Team created');
            }}
          >
            <input className="input" placeholder="Team name, e.g. Acme Inc." value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            <button className="btn-primary shrink-0">Create team</button>
          </form>
        </SettingSection>
        <SettingSection title="Join with a code">
          <form
            className="flex gap-2 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api.joinTeam(code.trim()), 'Joined the team');
            }}
          >
            <input className="input font-mono uppercase" placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} required />
            <button className="btn-secondary shrink-0">Join team</button>
          </form>
        </SettingSection>
      </div>
    );
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(team.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Members</p>
          <p className="mt-1 font-display text-3xl text-ink">{team.members.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Shared words</p>
          <p className="mt-1 font-display text-3xl text-ink">{team.shared_words}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Shared snippets</p>
          <p className="mt-1 font-display text-3xl text-ink">{team.shared_snippets}</p>
        </div>
      </div>

      <SettingSection title="Team">
        <form
          className="flex gap-2 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api.renameTeam(name.trim()), 'Team renamed');
          }}
        >
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
          {isAdmin && (
            <button className="btn-secondary shrink-0" disabled={name.trim() === team.name}>
              Rename
            </button>
          )}
        </form>
        {isAdmin && (
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-ink">Invite code</p>
              <p className="text-xs text-muted">Anyone with this code can join from Settings &gt; Team.</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="rounded-lg bg-subtle px-3 py-1.5 font-mono text-sm font-semibold tracking-wider text-ink">{team.invite_code}</span>
              <button className="btn-ghost px-2" onClick={copyCode} title="Copy code">
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
              <button className="btn-ghost px-2" onClick={() => run(api.regenerateInviteCode, 'New code generated')} title="Generate a new code">
                <RefreshCw size={15} />
              </button>
            </div>
          </div>
        )}
      </SettingSection>

      {isAdmin && (
        <SettingSection title="Invite by email">
          <form
            className="flex gap-2 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const list = emails.split(/[\s,;]+/).filter(Boolean);
              try {
                const res = await api.inviteToTeam(list);
                apply(res);
                const invited = res.results.filter((r) => r.status === 'invited').length;
                const skipped = res.results.filter((r) => r.status !== 'invited');
                toast.success(`Invited ${invited} ${invited === 1 ? 'person' : 'people'}`);
                skipped.forEach((s) => toast(`${s.email}: ${s.reason}`));
                setEmails('');
              } catch (err) {
                toast.error(api.errorMessage(err));
              }
            }}
          >
            <input className="input" placeholder="name@company.com, another@company.com" value={emails} onChange={(e) => setEmails(e.target.value)} required />
            <button className="btn-primary shrink-0">Send invites</button>
          </form>
          {team.pending_invitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between px-5 py-3">
              <p className="text-sm text-ink">
                {inv.email} <span className="text-xs text-faint">· pending · {relativeTime(inv.created_at)}</span>
              </p>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => run(() => api.revokeInvitation(inv.id), 'Invitation revoked')}>
                Revoke
              </button>
            </div>
          ))}
        </SettingSection>
      )}

      <SettingSection title="Members">
        {team.members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={m.name} src={m.avatar_url} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {m.name} {m.user_id === user.id && <span className="text-xs text-faint">(you)</span>}
              </p>
              <p className="truncate text-xs text-muted">{m.email}</p>
            </div>
            {m.is_owner ? (
              <span className="rounded-full bg-dawn-300 px-2.5 py-0.5 text-xs font-semibold text-dawn-800">Owner</span>
            ) : isAdmin && m.user_id !== user.id ? (
              <>
                <select className="input w-28 py-1 text-xs" value={m.role} onChange={(e) => run(() => api.setMemberRole(m.user_id, e.target.value), 'Role updated')}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="btn-ghost px-2" title="Remove from team" onClick={() => run(() => api.removeMember(m.user_id), `${m.name} removed`)}>
                  <UserMinus size={15} />
                </button>
              </>
            ) : (
              <span className="text-xs capitalize text-muted">{m.role}</span>
            )}
          </div>
        ))}
      </SettingSection>

      <div className="mt-6">
        <button className="btn-ghost text-flare-500 hover:bg-flare-50 dark:hover:bg-flare-600/20" onClick={() => setConfirmLeave(true)}>
          Leave team
        </button>
      </div>
      <ConfirmModal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        confirmLabel="Leave team"
        title={`Leave ${team.name}?`}
        message={team.is_owner ? 'Ownership passes to another admin (or the longest-standing member). Words you shared become personal again.' : 'Words and snippets you shared become personal again.'}
        onConfirm={() => run(api.leaveTeam, 'You left the team')}
      />
    </div>
  );
}
