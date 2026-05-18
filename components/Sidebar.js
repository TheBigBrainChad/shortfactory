'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Sidebar({ activePage }) {
  const router = useRouter();
  const [schedulerStatus, setSchedulerStatus] = useState({ enabled: false, isRunning: false });

  useEffect(() => {
    fetch('/api/scheduler')
      .then(r => r.json())
      .then(data => setSchedulerStatus(data))
      .catch(() => {});
  }, []);

  const navItems = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/studio', label: 'Studio', icon: '🎬' },
    { href: '/library', label: 'Library', icon: '📚' },
    { href: '/youtube', label: 'YouTube', icon: '📺' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>
          <span className="brand-icon">SF</span>
          ShortFactory
        </h1>
        <div className="brand-sub">Autonomous Content Engine</div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <a
            key={item.href}
            href={item.href}
            className={activePage === item.href ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); router.push(item.href); }}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="scheduler-status">
          <span className={`dot ${schedulerStatus.isRunning ? 'running' : schedulerStatus.enabled ? 'idle' : 'idle'}`}></span>
          <span>
            {schedulerStatus.isRunning ? 'Producing...' : schedulerStatus.enabled ? 'Auto-schedule ON' : 'Auto-schedule OFF'}
          </span>
        </div>
      </div>
    </aside>
  );
}