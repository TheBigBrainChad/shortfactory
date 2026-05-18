'use client';

import { useState, useEffect } from 'react';
import YouTubeStats from '../../components/YouTubeStats';
import AnalyticsChart from '../../components/AnalyticsChart';
import { showToast } from '../../components/Toast';

export default function YouTubePage() {
  const [channelInfo, setChannelInfo] = useState(null);
  const [videos, setVideos] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('views');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [channelRes, videosRes, analyticsRes] = await Promise.all([
        fetch('/api/youtube/channel').catch(() => null),
        fetch('/api/youtube/videos').catch(() => null),
        fetch('/api/youtube/analytics').catch(() => null)
      ]);

      if (channelRes?.ok) {
        const data = await channelRes.json();
        setChannelInfo(data);
        setIsConnected(!!data);
      }
      if (videosRes?.ok) {
        const data = await videosRes.json();
        setVideos(data.videos || []);
      }
      if (analyticsRes?.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('YouTube load error:', err);
    }
    setLoading(false);
  }

  const metricLabels = { views: 'Views', watchTime: 'Watch Time', subscribers: 'Subscribers' };
  const chartData = analytics?.rows?.map(r => r[metric]) || [];
  const chartLabels = analytics?.rows?.map(r => r.day?.substring(5) || '') || [];

  return (
    <>
      <div className="page-header">
        <h1>YouTube Analytics</h1>
        <p>Channel performance and video stats</p>
      </div>

      {!isConnected ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📺</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: 8 }}>Connect YouTube</h2>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 20 }}>Link your YouTube channel to view analytics and upload videos</p>
          <a href="/api/youtube/auth" className="btn btn-youtube" style={{ textDecoration: 'none' }}>
            🔗 Connect YouTube Channel
          </a>
        </div>
      ) : (
        <>
          <YouTubeStats channelInfo={channelInfo} />

          <div className="card" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="section-title" style={{ marginBottom: 0 }}>Performance</h3>
              <div className="filter-tabs">
                {Object.entries(metricLabels).map(([key, label]) => (
                  <button
                    key={key}
                    className={`filter-tab ${metric === key ? 'active' : ''}`}
                    onClick={() => setMetric(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <AnalyticsChart
              type="line"
              data={chartData}
              labels={chartLabels}
              colors={[metric === 'views' ? '#00f0ff' : metric === 'watchTime' ? '#ffb800' : '#00e676']}
              title={`${metricLabels[metric]} Over Time`}
              width={700}
              height={300}
            />
          </div>

          <div className="card" style={{ marginTop: 24 }}>
            <h3 className="section-title">Top Shorts</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>Title</th>
                    <th>Views</th>
                    <th>Likes</th>
                    <th>Comments</th>
                    <th>Published</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.length > 0 ? videos.slice(0, 10).map(v => (
                    <tr key={v.id}>
                      <td className="thumb-cell">
                        {v.thumbnail ? <img src={v.thumbnail} alt="" /> : '🎬'}
                      </td>
                      <td style={{ color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</td>
                      <td>{(v.views || 0).toLocaleString()}</td>
                      <td>{(v.likes || 0).toLocaleString()}</td>
                      <td>{(v.comments || 0).toLocaleString()}</td>
                      <td>{v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>
                        No videos found. Upload some Shorts first!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}