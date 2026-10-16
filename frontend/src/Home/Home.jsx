// File: src/Home/Home.jsx
// Home: greeting + stat pills, the dictation card and the full dictation
// history (search, archive, edit, retry, play audio).
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getStatsSummary } from '../api/apiClient';
import { useApp } from '../context/AppContext';
import { onServerEvent } from '../hooks/useServerEvents';
import DictationCard from './components/DictationCard';
import HistorySection from './components/HistorySection';
import StatsPills from './components/StatsPills';

export default function Home() {
  const { user, groqKey } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);

  const loadStats = useCallback(() => {
    getStatsSummary().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    loadStats();
    const offs = [
      onServerEvent('transcript.created', loadStats),
      onServerEvent('transcript.updated', loadStats),
    ];
    return () => offs.forEach((off) => off());
  }, [loadStats]);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title">Welcome back, {user?.first_name}</h1>
        <StatsPills stats={stats} />
      </header>

      {groqKey?.required && !groqKey.has_key && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-glow-200 bg-glow-50 px-5 py-4 dark:border-glow-500/40 dark:bg-glow-500/10">
          <div>
            <p className="font-medium text-ink">One more step: add your Groq key</p>
            <p className="text-sm text-muted">Murmur uses your own free Groq key for speech recognition. It takes a minute.</p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/settings/general', { state: { background: location } })}>
            Add key
          </button>
        </div>
      )}

      <div className={groqKey?.required && !groqKey.has_key ? 'mt-4' : 'mt-8'}>
        <DictationCard onDictated={loadStats} />
      </div>

      <HistorySection />
    </div>
  );
}
