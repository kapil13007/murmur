// File: src/Home/Home.jsx
// Home: greeting + stat pills, the dictation card and the full dictation
// history (search, archive, edit, retry, play audio).
import { useCallback, useEffect, useState } from 'react';
import { getStatsSummary } from '../api/apiClient';
import { useApp } from '../context/AppContext';
import { onServerEvent } from '../hooks/useServerEvents';
import DictationCard from './components/DictationCard';
import HistorySection from './components/HistorySection';
import StatsPills from './components/StatsPills';

export default function Home() {
  const { user } = useApp();
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

      <div className="mt-8">
        <DictationCard onDictated={loadStats} />
      </div>

      <HistorySection />
    </div>
  );
}
