'use client';

import { useState, useEffect, useCallback } from 'react';
import PipelineProgress from '../../components/PipelineProgress';
import ScriptEditor from '../../components/ScriptEditor';
import TopicGrid from '../../components/TopicGrid';
import VoicePicker from '../../components/VoicePicker';
import { showToast } from '../../components/Toast';

const STEPS = ['topic', 'script', 'configure', 'producing', 'preview'];
const STEP_LABELS = ['Topic', 'Script', 'Configure', 'Producing', 'Preview'];
const STEP_ICONS = ['1', '2', '3', '4', '5'];

const BG_CATEGORIES = [
  { key: '', label: 'All' },
  { key: 'minecraft gameplay', label: 'Minecraft' },
  { key: 'gta gameplay', label: 'GTA' },
  { key: 'fortnite gameplay', label: 'Fortnite' },
  { key: 'subway surfers gameplay', label: 'Subway Surfers' },
  { key: 'satisfying kinetic sand', label: 'Satisfying' },
  { key: 'cooking asmr', label: 'Cooking ASMR' },
  { key: 'nature scenery', label: 'Nature' },
  { key: 'space footage', label: 'Space' },
];

export default function StudioPage() {
  const [step, setStep] = useState(0);
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [customTopic, setCustomTopic] = useState('');
  const [script, setScript] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [voice, setVoice] = useState('en-US-GuyNeural');
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState(null);
  const [runStatus, setRunStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [videoPath, setVideoPath] = useState('');
  const [videoId, setVideoId] = useState(null);

  const [bgSearchQuery, setBgSearchQuery] = useState('');
  const [bgSearchResults, setBgSearchResults] = useState([]);
  const [bgSearching, setBgSearching] = useState(false);
  const [bgDownloading, setBgDownloading] = useState(null);
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [localBackgrounds, setLocalBackgrounds] = useState([]);
  const [bgTab, setBgTab] = useState('search');

  const [scriptVariants, setScriptVariants] = useState([]);
  const [showVariants, setShowVariants] = useState(false);
  const [captionStyle, setCaptionStyle] = useState('boxed');
  const [sceneMatching, setSceneMatching] = useState(false);

  useEffect(() => {
    loadTopics();
    loadLocalBackgrounds();
  }, []);

  async function loadTopics() {
    setLoading(true);
    try {
      const res = await fetch('/api/topics');
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics || data || []);
      }
    } catch {
      showToast('error', 'Failed to load topics');
    }
    setLoading(false);
  }

  async function loadLocalBackgrounds() {
    try {
      const res = await fetch('/api/background/download');
      if (res.ok) {
        const data = await res.json();
        setLocalBackgrounds(data.backgrounds || []);
      }
    } catch {}
  }

  async function generateNewTopics() {
    setLoading(true);
    try {
      const res = await fetch('/api/topics', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTopics(data.topics || data || []);
        showToast('success', 'New topics generated');
      } else {
        showToast('error', 'Failed to generate topics', data.error || 'Unknown error');
      }
    } catch (err) {
      showToast('error', 'Failed to generate topics', err.message);
    }
    setLoading(false);
  }

  async function handleTopicSelect(topic) {
    setSelectedTopic(topic);
    setCustomTopic('');
    setLoading(true);
    try {
      const res = await fetch('/api/script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.title, hook: topic.hook, variants: true })
      });
      if (res.ok) {
        const data = await res.json();
        setScriptVariants(data.variants || []);
        setShowVariants(true);
      } else {
        showToast('error', 'Failed to generate variants');
      }
    } catch {
      showToast('error', 'Connection error');
    }
    setLoading(false);
  }

  async function handleCustomTopic() {
    if (!customTopic.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: customTopic, variants: true })
      });
      if (res.ok) {
        const data = await res.json();
        setScriptVariants(data.variants || []);
        setShowVariants(true);
      }
    } catch {
      showToast('error', 'Connection error');
    }
    setLoading(false);
  }

  async function selectVariant(variant) {
    setLoading(true);
    try {
      const res = await fetch('/api/script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: selectedTopic?.title || customTopic,
          script: variant.script
        })
      });
      if (res.ok) {
        const data = await res.json();
        setScript(variant.script);
        setTitle(data.title || selectedTopic?.title || customTopic);
        setDescription(data.description || '');
        setTags(data.tags || []);
        setShowVariants(false);
        setStep(1);
      } else {
        showToast('error', 'Failed to generate metadata');
      }
    } catch {
      showToast('error', 'Connection error');
    }
    setLoading(false);
  }

  async function searchBackgrounds() {
    const query = bgSearchQuery.trim() || 'gameplay background no commentary';
    setBgSearching(true);
    try {
      const res = await fetch(`/api/background/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setBgSearchResults(data.results || []);
        if (data.results?.length === 0) showToast('info', 'No results found');
      } else {
        const err = await res.json();
        showToast('error', 'Search failed', err.error);
      }
    } catch {
      showToast('error', 'Search connection error');
    }
    setBgSearching(false);
  }

  async function downloadBackground(videoId, videoTitle) {
    setBgDownloading(videoId);
    try {
      const res = await fetch('/api/background/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, url: `https://www.youtube.com/watch?v=${videoId}` })
      });
      if (res.ok) {
        const data = await res.json();
        showToast('success', 'Background downloaded!', data.filename);
        setSelectedBackground(data.path);
        await loadLocalBackgrounds();
      } else {
        const err = await res.json();
        showToast('error', 'Download failed', err.error);
      }
    } catch {
      showToast('error', 'Download connection error');
    }
    setBgDownloading(null);
  }

  async function startProduction() {
    setLoading(true);
    try {
      const res = await fetch('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          script: script,
          topic: selectedTopic?.title || customTopic,
          voice: voice,
          description: description,
          tags: tags.join(','),
          background_video: selectedBackground || '',
          caption_style: captionStyle,
          scene_matching: sceneMatching
        })
      });

      if (res.ok) {
        const data = await res.json();
        setRunId(data.runId);
        setVideoId(data.videoId);
        setStep(3);
        pollStatus(data.runId);
      } else {
        const err = await res.json();
        showToast('error', 'Pipeline failed', err.error || 'Unknown error');
      }
    } catch {
      showToast('error', 'Connection error');
    }
    setLoading(false);
  }

  const pollStatus = useCallback((id) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pipeline/status/${id}`);
        if (res.ok) {
          const data = await res.json();
          setRunStatus(data);
          if (data.run) {
            const logsList = (data.run.logs || '').split('\n').filter(Boolean);
            setLogs(logsList);
          }
          if (data.run?.status === 'completed') {
            clearInterval(interval);
            setVideoPath(data.video?.video_path || '');
            setStep(4);
            showToast('success', 'Video produced!', 'Ready to preview and upload');
          } else if (data.run?.status === 'failed') {
            clearInterval(interval);
            showToast('error', 'Pipeline failed', data.run.error || 'Unknown error');
          }
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);
    return interval;
  }, []);

  async function uploadToYouTube() {
    if (!videoId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, action: 'upload' })
      });
      if (res.ok) {
        const data = await res.json();
        showToast('success', 'Uploaded to YouTube!', data.youtubeUrl);
      } else {
        const err = await res.json();
        showToast('error', 'Upload failed', err.error || 'Unknown error');
      }
    } catch {
      showToast('error', 'Connection error');
    }
    setLoading(false);
  }

  async function retryPipeline() {
    if (!videoId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId })
      });
      if (res.ok) {
        const data = await res.json();
        setRunId(data.runId);
        setStep(3);
        pollStatus(data.runId);
        showToast('info', 'Re-producing video...');
      }
    } catch {
      showToast('error', 'Connection error');
    }
    setLoading(false);
  }

  async function cancelProduction() {
    if (!runId) return;
    try {
      await fetch('/api/pipeline/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      });
      showToast('info', 'Cancelling pipeline...');
    } catch {
      showToast('error', 'Failed to cancel');
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Pipeline Studio</h1>
        <p>Go from topic to published Short</p>
      </div>

      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
            <div className={`wizard-step ${i === step ? 'active' : i < step ? 'completed' : ''}`}>
              <div className="step-num">{i < step ? '✓' : STEP_ICONS[i]}</div>
              <div className="step-text">{STEP_LABELS[i]}</div>
            </div>
            {i < STEPS.length - 1 && <div className={`wizard-line ${i < step ? 'completed' : ''}`} />}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        {step === 0 && (
          <div>
            {showVariants ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 className="section-title" style={{ marginBottom: 0 }}>Pick a Script</h2>
                  <button className="btn btn-ghost" onClick={() => { setShowVariants(false); setScriptVariants([]); }} style={{ fontSize: '0.84rem' }}>
                    ← Back to topics
                  </button>
                </div>

                {scriptVariants.length > 0 ? (
                  <div className="variant-grid">
                    {scriptVariants.map((variant) => (
                      <div
                        key={variant.label}
                        className="variant-card"
                        style={{
                          background: 'var(--bg-surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          padding: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          borderLeft: `3px solid ${variant.label === 'A' ? 'var(--cyan)' : variant.label === 'B' ? 'var(--amber)' : 'var(--purple)'}`,
                        }}
                        onClick={() => selectVariant(variant)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: '1.2rem',
                              fontWeight: 700,
                              color: variant.label === 'A' ? 'var(--cyan)' : variant.label === 'B' ? 'var(--amber)' : 'var(--purple)'
                            }}>{variant.label}</span>
                            <span style={{
                              fontSize: '0.72rem',
                              fontFamily: 'var(--font-mono)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              color: 'var(--text-tertiary)',
                              background: 'var(--bg-surface-3)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)'
                            }}>{variant.angle}</span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                            {(variant.script || '').trim().split(/\s+/).filter(Boolean).length} words
                          </span>
                        </div>

                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          "{variant.hook}"
                        </div>

                        <div style={{
                          fontSize: '0.82rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          fontFamily: 'var(--font-body)'
                        }}>
                          {(variant.script || '').split('\n').filter(l => l.trim()).slice(0, 3).join(' ').substring(0, 180)}...
                        </div>

                        <button className="btn btn-primary" style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}>
                          Select Variant {variant.label}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                    No variants generated. Go back and try again.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h2 className="section-title">Choose a Topic</h2>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <button className="btn btn-secondary" onClick={generateNewTopics} disabled={loading}>
                    {loading ? 'Loading...' : '🔄 Generate New Topics'}
                  </button>
                </div>

                {topics.length > 0 ? (
                  <TopicGrid topics={topics} selectedId={selectedTopic?.id} onSelect={handleTopicSelect} />
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">💡</div>
                    <h3>No topics yet</h3>
                    <p>Click "Generate New Topics" to get AI suggestions</p>
                  </div>
                )}

                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                  <h3 className="section-title">Or enter a custom topic</h3>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="text"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      placeholder="e.g., Why octopuses have three hearts"
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary" onClick={handleCustomTopic} disabled={!customTopic.trim() || loading}>
                      Generate Variants →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="section-title">Edit Script</h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.84rem', marginBottom: 16 }}>
              Target: 120-150 words (45-55s spoken). Hook → Story → CTA formula.
            </p>
            <ScriptEditor value={script} onChange={setScript} />

            <div style={{ marginTop: 20 }}>
              <h3 className="section-title">Video Details</h3>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tags (comma-separated)</label>
                  <input type="text" value={typeof tags === 'string' ? tags : tags.join(', ')} onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
              <button className="btn btn-primary" onClick={() => setStep(2)}>Next →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="section-title">Configure & Produce</h2>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Voice</h3>
              <VoicePicker selected={voice} onSelect={setVoice} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Caption Style</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { key: 'boxed', label: 'Boxed', desc: 'Opaque background box' },
                  { key: 'outline', label: 'Outline', desc: 'Clean stroke only' },
                  { key: 'neon', label: 'Neon', desc: 'Cyan glow effect' },
                ].map((s) => (
                  <div
                    key={s.key}
                    onClick={() => setCaptionStyle(s.key)}
                    style={{
                      flex: 1,
                      background: captionStyle === s.key ? 'rgba(0,240,255,0.08)' : 'var(--bg-surface-2)',
                      border: captionStyle === s.key ? '2px solid var(--cyan)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Background Mode</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <div
                  onClick={() => setSceneMatching(false)}
                  style={{
                    flex: 1,
                    background: !sceneMatching ? 'rgba(0,240,255,0.08)' : 'var(--bg-surface-2)',
                    border: !sceneMatching ? '2px solid var(--cyan)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>Single Clip</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>One background video (gameplay or selected clip)</div>
                </div>
                <div
                  onClick={() => setSceneMatching(true)}
                  style={{
                    flex: 1,
                    background: sceneMatching ? 'rgba(0,240,255,0.08)' : 'var(--bg-surface-2)',
                    border: sceneMatching ? '2px solid var(--cyan)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>Smart Scenes</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>AI finds matching clips for each part of the script</div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Background Video</h3>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button className={`btn ${bgTab === 'search' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setBgTab('search')} style={{ fontSize: '0.84rem' }}>🔍 Search YouTube</button>
                <button className={`btn ${bgTab === 'local' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setBgTab('local'); loadLocalBackgrounds(); }} style={{ fontSize: '0.84rem' }}>📁 Local Files</button>
              </div>

              {bgTab === 'search' && (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input
                      type="text"
                      value={bgSearchQuery}
                      onChange={(e) => setBgSearchQuery(e.target.value)}
                      placeholder="Search gameplay, satisfying, nature..."
                      style={{ flex: 1 }}
                      onKeyDown={(e) => e.key === 'Enter' && searchBackgrounds()}
                    />
                    <button className="btn btn-secondary" onClick={searchBackgrounds} disabled={bgSearching}>
                      {bgSearching ? '...' : 'Search'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {BG_CATEGORIES.filter(c => c.key).map(cat => (
                      <button
                        key={cat.key}
                        className="btn btn-ghost"
                        style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                        onClick={() => { setBgSearchQuery(cat.key); }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  {bgSearchResults.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
                      {bgSearchResults.map((r) => (
                        <div
                          key={r.videoId}
                          className="bg-search-card"
                          style={{
                            background: selectedBackground?.includes(r.videoId) ? 'var(--bg-surface-3)' : 'var(--bg-surface-2)',
                            border: selectedBackground?.includes(r.videoId) ? '2px solid var(--cyan)' : '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            cursor: bgDownloading === r.videoId ? 'wait' : 'pointer',
                            opacity: bgDownloading === r.videoId ? 0.6 : 1,
                            transition: 'all 0.2s'
                          }}
                          onClick={() => {
                            if (bgDownloading === r.videoId) return;
                            if (selectedBackground?.includes(r.videoId)) {
                              setSelectedBackground(null);
                            } else {
                              downloadBackground(r.videoId, r.title);
                            }
                          }}
                        >
                          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: 'var(--bg-surface-3)' }}>
                            {r.thumbnail && <img src={r.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />}
                            {bgDownloading === r.videoId && (
                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan)', fontWeight: 700, fontSize: '0.84rem' }}>
                                Downloading...
                              </div>
                            )}
                            {selectedBackground?.includes(r.videoId) && (
                              <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--cyan)', color: 'var(--bg-primary)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700 }}>✓</div>
                            )}
                          </div>
                          <div style={{ padding: 8 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.title}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{r.channel}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : bgSearching ? (
                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 32 }}>Searching...</div>
                  ) : (
                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 32 }}>Search for a background video or pick a category above</div>
                  )}
                </div>
              )}

              {bgTab === 'local' && (
                <div>
                  {localBackgrounds.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                      {localBackgrounds.map((bg) => (
                        <div
                          key={bg.filename}
                          onClick={() => setSelectedBackground(selectedBackground === bg.path ? null : bg.path)}
                          style={{
                            background: selectedBackground === bg.path ? 'rgba(0,240,255,0.08)' : 'var(--bg-surface-2)',
                            border: selectedBackground === bg.path ? '2px solid var(--cyan)' : '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 12,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>{bg.filename}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{bg.size} MB</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 32 }}>
                      No local backgrounds yet. Search and download one above.
                    </div>
                  )}
                </div>
              )}

              {selectedBackground && (
                <div style={{ marginTop: 12, background: 'rgba(0,240,255,0.06)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Selected Background</span>
                    <div style={{ fontSize: '0.86rem', marginTop: 2 }}>{selectedBackground.split('/').pop()}</div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => setSelectedBackground(null)} style={{ fontSize: '0.78rem' }}>Clear</button>
                </div>
              )}
            </div>

            <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Topic</span>
                  <div style={{ fontSize: '0.93rem', marginTop: 4 }}>{selectedTopic?.title || customTopic}</div>
                </div>
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Words</span>
                  <div style={{ fontSize: '0.93rem', marginTop: 4 }}>{script.trim().split(/\s+/).filter(Boolean).length} words</div>
                </div>
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Duration</span>
                  <div style={{ fontSize: '0.93rem', marginTop: 4 }}>~{Math.round(script.trim().split(/\s+/).filter(Boolean).length / 2.5)}s</div>
                </div>
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Voice</span>
                  <div style={{ fontSize: '0.93rem', marginTop: 4 }}>{voice.replace('en-', '').replace('Neural', '')}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" onClick={startProduction} disabled={loading}>
                {loading ? 'Starting...' : '🎬 Produce Video'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="section-title">Producing Video...</h2>
            <PipelineProgress
              currentStage={runStatus?.run?.stage || 'tts'}
              status={runStatus?.run?.status || 'running'}
            />

            <div style={{ marginTop: 60 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pipeline Log</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--cyan)' }}>{runStatus?.run?.progress || 0}%</span>
              </div>
              <div className="progress-bar" style={{ marginBottom: 16 }}>
                <div className="progress-fill" style={{ width: `${runStatus?.run?.progress || 0}%` }} />
              </div>
              <div className="terminal" style={{ maxHeight: 280 }}>
                {logs.length > 0 ? logs.map((line, i) => {
                  let cls = 'log-info';
                  if (line.includes('[stderr]')) cls = 'log-warn';
                  if (line.includes('error') || line.includes('Error') || line.includes('❌') || line.includes('failed')) cls = 'log-error';
                  if (line.includes('✅') || line.includes('✓') || line.includes('completed') || line.includes('saved')) cls = 'log-success';
                  return <div key={i} className={`log-line ${cls}`}>{line}</div>;
                }) : <div style={{ color: 'var(--text-tertiary)' }}>Starting pipeline... logs will appear here.</div>}
              </div>
            </div>

            {runStatus?.run?.status === 'running' && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-danger" onClick={cancelProduction}>
                  ⛔ Cancel Production
                </button>
              </div>
            )}

            {runStatus?.run?.status === 'failed' && (
              <div style={{ marginTop: 24 }}>
                <div style={{ background: 'rgba(255,59,92,0.1)', border: '1px solid var(--red)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 16 }}>
                  <strong style={{ color: 'var(--red)' }}>Pipeline Failed</strong>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: 4 }}>{runStatus.run.error || 'Unknown error'}</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={retryPipeline}>🔄 Retry</button>
                  <button className="btn btn-ghost" onClick={() => setStep(1)}>Edit Script</button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="section-title">Preview & Upload</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div className="video-player-wrap">
                  {videoId ? (
                    <video src={`/api/videos/${videoId}`} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ aspectRatio: '9/16', background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '2rem', opacity: 0.3 }}>🎬</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)', padding: 20 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>{title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginBottom: 16 }}>{description}</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Duration</span>
                      <div>{runStatus?.video?.duration || '—'}s</div>
                    </div>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>File Size</span>
                      <div>{runStatus?.video?.file_size || '—'} MB</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button className="btn btn-youtube" onClick={uploadToYouTube} disabled={loading} style={{ justifyContent: 'center' }}>
                      📤 Upload to YouTube
                    </button>
                    {videoId && (
                      <a href={`/api/videos/${videoId}/download`} download style={{ textDecoration: 'none' }}>
                        <button className="btn btn-secondary" style={{ justifyContent: 'center', width: '100%' }}>
                          ⬇️ Download Video
                        </button>
                      </a>
                    )}
                    <button className="btn btn-ghost" onClick={() => { setStep(0); setSelectedTopic(null); setScript(''); setTitle(''); setScriptVariants([]); setShowVariants(false); }} style={{ justifyContent: 'center' }}>
                      ✨ Create Another
                    </button>
                    <button className="btn btn-ghost" onClick={retryPipeline} style={{ justifyContent: 'center' }}>
                      🔄 Re-render
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}