'use client';

import { useState, useEffect } from 'react';
import VideoCard from '../../components/VideoCard';
import { showToast } from '../../components/Toast';

export default function LibraryPage() {
  const [videos, setVideos] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, [filter]);

  async function loadVideos() {
    setLoading(true);
    try {
      const statusParam = filter !== 'all' ? `&status=${filter}` : '';
      const res = await fetch(`/api/videos?limit=100${statusParam}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch {
      showToast('error', 'Failed to load videos');
    }
    setLoading(false);
  }

  async function deleteVideo(id) {
    if (!confirm('Delete this video? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setVideos(prev => prev.filter(v => v.id !== id));
        setSelectedVideo(null);
        showToast('success', 'Video deleted');
      }
    } catch {
      showToast('error', 'Failed to delete');
    }
  }

  async function uploadVideo(id) {
    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id, action: 'upload' })
      });
      if (res.ok) {
        const data = await res.json();
        showToast('success', 'Uploaded to YouTube!', data.youtubeUrl);
        loadVideos();
      } else {
        const err = await res.json();
        showToast('error', 'Upload failed', err.error);
      }
    } catch {
      showToast('error', 'Connection error');
    }
  }

  const statusFilters = [
    { key: 'all', label: 'All' },
    { key: 'uploaded', label: 'Published' },
    { key: 'draft', label: 'Drafts' },
    { key: 'produced', label: 'Produced' },
    { key: 'failed', label: 'Failed' }
  ];

  return (
    <>
      <div className="page-header">
        <h1>Video Library</h1>
        <p>All your produced Shorts</p>
      </div>

      <div className="filter-tabs">
        {statusFilters.map(f => (
          <button
            key={f.key}
            className={`filter-tab ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {videos.length > 0 ? (
        <div className="video-grid">
          {videos.map(v => (
            <VideoCard key={v.id} video={v} onClick={(v) => setSelectedVideo(v)} />
          ))}
        </div>
      ) : (
        <div className="empty-state card">
          <div className="empty-icon">🎬</div>
          <h3>No videos yet</h3>
          <p>Head to the Studio to create your first Short</p>
        </div>
      )}

      {selectedVideo && (
        <div className="modal-overlay" onClick={() => setSelectedVideo(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2>{selectedVideo.title}</h2>

            {selectedVideo.video_path && (
              <div style={{ marginBottom: 16, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-surface-2)' }}>
                <video
                  src={`/api/videos/${selectedVideo.id}`}
                  controls
                  playsInline
                  style={{ width: '100%', maxHeight: 420, display: 'block' }}
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Status</span>
                <div><span className={`badge badge-${selectedVideo.status}`}>{selectedVideo.status}</span></div>
              </div>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Duration</span>
                <div>{selectedVideo.duration || '—'}s</div>
              </div>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Created</span>
                <div>{new Date(selectedVideo.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Voice</span>
                <div>{selectedVideo.voice}</div>
              </div>
            </div>

            {selectedVideo.script && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Script</span>
                <div style={{ background: '#0a0c10', borderRadius: 'var(--radius-md)', padding: 12, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)', maxHeight: 150, overflow: 'auto' }}>
                  {selectedVideo.script}
                </div>
              </div>
            )}

            {selectedVideo.youtube_url && (
              <div style={{ marginBottom: 16 }}>
                <a href={selectedVideo.youtube_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}>
                  {selectedVideo.youtube_url}
                </a>
              </div>
            )}

            <div className="modal-actions">
              {selectedVideo.status === 'produced' && (
                <button className="btn btn-youtube" onClick={() => uploadVideo(selectedVideo.id)}>📤 Upload to YouTube</button>
              )}
              {selectedVideo.video_path && (
                <a href={`/api/videos/${selectedVideo.id}/download`} download style={{ textDecoration: 'none' }}>
                  <button className="btn btn-secondary">⬇️ Download</button>
                </a>
              )}
              <button className="btn btn-danger" onClick={() => deleteVideo(selectedVideo.id)}>🗑 Delete</button>
              <button className="btn btn-ghost" onClick={() => setSelectedVideo(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}