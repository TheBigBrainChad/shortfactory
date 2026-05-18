'use client';

export default function VideoCard({ video, onClick }) {
  const statusMap = {
    draft: 'badge-draft',
    producing: 'badge-producing',
    produced: 'badge-draft',
    uploaded: 'badge-uploaded',
    failed: 'badge-failed',
    rendering: 'badge-rendering',
    published: 'badge-published'
  };

  return (
    <div className="video-card" onClick={() => onClick && onClick(video)}>
      <div className="thumb">
        {video.thumbnail_path ? (
          <img src={`/api/videos/${video.id}/thumbnail`} alt={video.title} />
        ) : (
          <span className="thumb-icon">🎬</span>
        )}
        {video.duration > 0 && (
          <span className="duration-badge">{Math.floor(video.duration)}s</span>
        )}
      </div>
      <div className="card-body">
        <h3>{video.title}</h3>
        <div className="card-meta">
          <span className={`badge ${statusMap[video.status] || 'badge-draft'}`}>
            {video.status}
          </span>
          <span>{new Date(video.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}