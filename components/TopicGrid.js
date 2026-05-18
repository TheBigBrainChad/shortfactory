'use client';

export default function TopicGrid({ topics, selectedId, onSelect }) {
  return (
    <div className="topic-grid">
      {topics.map((topic, i) => (
        <div
          key={topic.id || i}
          className={`topic-card ${selectedId === (topic.id || i) ? 'selected' : ''}`}
          onClick={() => onSelect(topic)}
        >
          <span className="topic-badge">{topic.category}</span>
          <div className="topic-title">{topic.title}</div>
          {topic.reason && <div className="topic-reason">{topic.reason}</div>}
        </div>
      ))}
    </div>
  );
}