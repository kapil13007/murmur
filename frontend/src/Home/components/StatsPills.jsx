// File: src/Home/components/StatsPills.jsx
// Wispr's header pills: streak, total words, average speed.
import { formatNumber } from '../../utils/formatter';

function Pill({ emoji, value, label, title }) {
  return (
    <span title={title} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-3 py-1.5 text-sm">
      <span aria-hidden>{emoji}</span>
      <span className="font-semibold text-ink">{value}</span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

export default function StatsPills({ stats }) {
  if (!stats) return <div className="h-9" />;
  const streakWeeks = stats.day_streak >= 7;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill
        emoji="🔥"
        value={streakWeeks ? stats.week_streak : stats.day_streak}
        label={streakWeeks ? `week${stats.week_streak === 1 ? '' : 's'}` : `day${stats.day_streak === 1 ? '' : 's'}`}
        title={`Current streak · longest ${stats.longest_day_streak} days`}
      />
      <Pill emoji="🚀" value={formatNumber(stats.total_words)} label="words" title={`${formatNumber(stats.words_this_week)} this week`} />
      <Pill emoji="🏆" value={stats.average_wpm || '—'} label="WPM" title="Average dictation speed" />
    </div>
  );
}
