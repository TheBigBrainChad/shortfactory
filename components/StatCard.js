'use client';

export default function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="stat-card" style={{ '--stat-accent': accent || 'var(--cyan)' }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}