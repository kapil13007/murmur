// File: src/components/entries/ShareToggle.jsx
import Toggle from '../ui/Toggle';

export default function ShareToggle({ noun, hasTeam, checked, onChange }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5"
      title={hasTeam ? '' : `To share ${noun}s with your team, go to Settings and set up a team.`}
    >
      <div>
        <p className="text-sm font-medium text-ink">Share with team</p>
        <p className="text-xs text-muted">{hasTeam ? 'Everyone on your team will get it.' : 'Create or join a team in Settings first.'}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={!hasTeam} label="Share with team" />
    </div>
  );
}
