'use client';

export default function YouTubeStats({ channelInfo }) {
  if (!channelInfo) {
    return (
      <div className="youtube-stats-grid">
        {[1,2,3,4].map(i => (
          <div key={i} className="stat-card">
            <div className="stat-label">—</div>
            <div className="stat-value" style={{ opacity: 0.3 }}>0</div>
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    { icon: '👥', label: 'SUBSCRIBERS', value: Number(channelInfo.subscriberCount || 0).toLocaleString(), accent: 'var(--cyan)' },
    { icon: '👁', label: 'TOTAL VIEWS', value: Number(channelInfo.viewCount || 0).toLocaleString(), accent: 'var(--amber)' },
    { icon: '🎬', label: 'VIDEOS', value: Number(channelInfo.videoCount || 0).toLocaleString(), accent: 'var(--green)' },
    { icon: '📈', label: 'CHANNEL', value: channelInfo.title || '—', accent: 'var(--purple)' }
  ];

  return (
    <div className="youtube-stats-grid">
      {stats.map(s => (
        <div key={s.label} className="stat-card" style={{ '--stat-accent': s.accent }}>
          <div className="stat-icon">{s.icon}</div>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value">{s.value}</div>
        </div>
      ))}
    </div>
  );
}