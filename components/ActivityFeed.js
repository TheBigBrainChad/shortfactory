'use client';

export default function ActivityFeed({ runs }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <h3>No activity yet</h3>
        <p>Pipeline runs will appear here</p>
      </div>
    );
  }

  const statusIcons = {
    running: { icon: '🔄', cls: 'running' },
    completed: { icon: '✅', cls: 'success' },
    failed: { icon: '❌', cls: 'error' },
    pending: { icon: '⏸', cls: 'pending' }
  };

  return (
    <ul className="activity-feed">
      {runs.map(run => {
        const st = statusIcons[run.status] || statusIcons.pending;
        return (
          <li key={run.id} className="activity-item">
            <div className={`activity-icon ${st.cls}`}>{st.icon}</div>
            <div className="activity-text">
              <strong>{run.video_id || 'Unknown'}</strong>
              <p>{run.stage} — {run.mode}</p>
            </div>
            <span className="activity-time">
              {run.started_at ? new Date(run.started_at).toLocaleTimeString() : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}