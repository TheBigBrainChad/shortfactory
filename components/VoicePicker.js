'use client';

import { useState, useRef } from 'react';

const VOICES = [
  { id: 'en-US-GuyNeural', name: 'Guy', desc: 'Deep, authoritative male', default: true },
  { id: 'en-US-ChristopherNeural', name: 'Christopher', desc: 'Energetic male' },
  { id: 'en-US-AndrewMultilingualNeural', name: 'Andrew', desc: 'Clear male' },
  { id: 'en-US-JennyNeural', name: 'Jenny', desc: 'Engaging female' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', desc: 'British male' }
];

export default function VoicePicker({ selected, onSelect }) {
  const [playing, setPlaying] = useState(null);
  const audioRef = useRef(null);

  async function playPreview(voiceId, e) {
    e.stopPropagation();
    if (playing === voiceId) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPlaying(voiceId);
    try {
      const audio = new Audio(`/api/tts/preview?voice=${encodeURIComponent(voiceId)}`);
      audioRef.current = audio;
      audio.onended = () => setPlaying(null);
      audio.onerror = () => setPlaying(null);
      await audio.play();
    } catch {
      setPlaying(null);
    }
  }

  return (
    <div className="voice-grid">
      {VOICES.map(voice => (
        <div
          key={voice.id}
          className={`voice-card ${selected === voice.id ? 'selected' : ''}`}
          onClick={() => onSelect(voice.id)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="voice-name">{voice.name}</div>
            <button
              className="btn btn-ghost voice-preview-btn"
              onClick={(e) => playPreview(voice.id, e)}
              title="Preview voice"
              style={{ padding: '4px 8px', fontSize: '0.78rem', minWidth: 'unset' }}
            >
              {playing === voice.id ? '⏹' : '▶'}
            </button>
          </div>
          <div className="voice-desc">{voice.desc}</div>
        </div>
      ))}
    </div>
  );
}

export { VOICES };
