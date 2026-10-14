// File: src/Insights/Insights.jsx
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, getHeatmap, getStatsSummary, getTopApps } from '../api/apiClient';
import { formatNumber } from '../utils/formatter';
import { PageSpinner } from '../components/ui/Spinner';
import Heatmap from './components/Heatmap';
import StatCard from './components/StatCard';
import TopApps from './components/TopApps';

// Wispr's streak taglines, picked by streak length.
function streakTagline(days) {
  if (days === 0) return 'Dictate today to start a streak.';
  if (days < 3) return 'Nice rhythm building.';
  if (days < 6) return 'Your habit is getting solid.';
  if (days < 7) return 'Almost a full week!';
  if (days < 14) return 'One full week. Habit unlocked.';
  if (days < 30) return 'Consistency looks good on you.';
  if (days < 50) return 'A full month. You showed up every single day.';
  if (days < 100) return '50 days of non-stop Flow. Unreal.';
  return '100 days. You are a legend. Full stop.';
}

export default function Insights() {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([getStatsSummary(), getHeatmap(), getTopApps()])
      .then(([summary, heatmap, apps]) => setData({ summary, heatmap, apps }))
      .catch((err) => toast.error(errorMessage(err)));
  }, []);

  if (!data) return <PageSpinner />;
  const { summary, heatmap, apps } = data;
  const hours = Math.floor(summary.time_saved_minutes / 60);
  const minutes = summary.time_saved_minutes % 60;

  return (
    <div>
      <h1 className="page-title">Insights</h1>
      <p className="mt-1 text-sm text-muted">How Flow fits into your day.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total words" value={formatNumber(summary.total_words)} hint={`${formatNumber(summary.words_this_week)} this week`} tone="dawn" />
        <StatCard label="Average speed" value={summary.average_wpm || '—'} unit="WPM" hint="vs ~40 WPM typing" tone="fathom" />
        <StatCard label="Current streak" value={summary.day_streak} unit={summary.day_streak === 1 ? 'day' : 'days'} hint={streakTagline(summary.day_streak)} tone="glow" />
        <StatCard label="Time saved" value={hours ? `${hours}h ${minutes}m` : `${minutes}m`} hint={`${formatNumber(summary.total_dictations)} dictations`} tone="signal" />
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink">Activity</h2>
          <p className="text-sm text-muted">
            Longest streak · <span className="font-semibold text-ink">{summary.longest_day_streak}</span> day{summary.longest_day_streak === 1 ? '' : 's'}
          </p>
        </div>
        <Heatmap data={heatmap} />
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink">Top apps</h2>
          <p className="text-sm text-muted">
            Total apps used · <span className="font-semibold text-ink">{summary.total_apps}</span>
          </p>
        </div>
        <TopApps apps={apps} />
      </section>
    </div>
  );
}
