'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StatCard from '../components/StatCard';
import ActivityFeed from '../components/ActivityFeed';
import VideoCard from '../components/VideoCard';
import { showToast } from '../components/Toast';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, uploaded: 0, failed: 0, totalViews: 0 });
  const [todayCount, setTodayCount] = useState(0);
  const [videos, setVideos] = useState([]);
  const [runs, setRuns] = useState([]);
  const [scheduler, setScheduler] = useState({});
  const [latestVideo, setLatestVideo] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [statsRes, videosRes, runsRes, schedRes] = await Promise.all([
        fetch('/api/videos?stats=true'),
        fetch('/api/videos?limit=6'),
        fetch('/api/videos?runs=true'),
        fetch('/api/scheduler')
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (videosRes.ok) {
        const data = await videosRes.json();
        setVideos(data.videos || data);
      }
      if (runsRes.ok) {
        const data = await runsRes.json();
        setRuns(data.runs || []);
      }
      if (schedRes.ok) setScheduler(await schedRes.json());
    } catch (err) {
      showToast('error', 'Failed to load dashboard', err.message);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Your content factory at a glance</p>
      </div>

      <div className="stat-grid">
        <StatCard icon="🎬" label="TODAY" value={stats.todayCount ?? todayCount} accent="var(--cyan)" />
        <StatCard icon="📤" label="TOTAL UPLOADS" value={stats.uploaded} accent="var(--amber)" />
        <StatCard icon="👁" label="TOTAL VIEWS" value={(stats.totalViews || 0).toLocaleString()} accent="var(--green)" />
        <StatCard
          icon="⏰"
          label="NEXT RUN"
          value={scheduler?.enabled ? (scheduler?.nextRun ? new Date(scheduler.nextRun).toLocaleTimeString() : 'Scheduled') : 'Off'}
          sub={scheduler?.isRunning ? 'Running now...' : ''}
          accent="var(--purple)"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginTop: 8 }}>
        <div>
          <h2 className="section-title">Latest Videos</h2>
          {videos.length > 0 ? (
            <div className="video-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {videos.slice(0, 4).map(v => (
                <VideoCard key={v.id} video={v} onClick={() => router.push('/library')} />
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: '2rem', opacity: 0.3, marginBottom: 12 }}>🎬</div>
              <h3 style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>No videos yet</h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.86rem' }}>Head to the Studio to create your first Short</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => router.push('/studio')}>🎬 New Short</button>
            </div>
          )}
        </div>

        <div>
          <h2 className="section-title">Activity</h2>
          <div className="card" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <ActivityFeed runs={runs} />
          </div>

          <div style={{ marginTop: 20 }}>
            <h2 className="section-title">Quick Actions</h2>
            <div className="quick-actions" style={{ flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => router.push('/studio')}>🎬 New Short</button>
              <button className="btn btn-secondary" onClick={async () => {
                try {
                  const res = await fetch('/api/scheduler', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'trigger' })
                  });
                  if (res.ok) showToast('success', 'Auto production triggered');
                  else showToast('error', 'Failed to trigger');
                } catch { showToast('error', 'Connection error'); }
              }}>🤖 Auto Run</button>
              <button className="btn btn-ghost" onClick={() => router.push('/settings')}>⚙️ Settings</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}