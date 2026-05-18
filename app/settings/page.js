'use client';

import { useState, useEffect } from 'react';
import { showToast } from '../../components/Toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [gameplayFiles, setGameplayFiles] = useState([]);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const [settingsRes, configRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/config')
      ]);
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (configRes.ok) {
        const config = await configRes.json();
        setYoutubeConnected(config.youtube_connected || false);
      }
    } catch {
      showToast('error', 'Failed to load settings');
    }
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        showToast('success', 'Settings saved');
      } else {
        showToast('error', 'Failed to save settings');
      }
    } catch {
      showToast('error', 'Connection error');
    }
    setSaving(false);
  }

  async function testKey(key) {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_key', key, value: settings[key] })
      });
      const data = await res.json();
      if (data.valid) showToast('success', `${key.replace(/_/g, ' ')} is valid ✓`);
      else showToast('error', `${key.replace(/_/g, ' ')} is invalid`, data.error || '');
    } catch {
      showToast('error', 'Connection error');
    }
  }

  async function clearVideos() {
    if (!confirm('Are you sure? This will delete ALL videos and cannot be undone.')) return;
    if (!confirm('REALLY delete all videos?')) return;
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_videos' })
      });
      if (res.ok) showToast('success', 'All videos cleared');
    } catch {
      showToast('error', 'Failed to clear videos');
    }
  }

  async function resetSettings() {
    if (!confirm('Reset all settings to defaults?')) return;
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      if (res.ok) {
        showToast('success', 'Settings reset');
        loadSettings();
      }
    } catch {
      showToast('error', 'Failed to reset');
    }
  }

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  return (
    <>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure your content factory</p>
      </div>

      <div className="settings-section card">
        <h3>⏰ Schedule</h3>
        <div className="settings-row">
          <label>Auto-Production</label>
          <div className="field">
            <div className="toggle-wrap">
              <input type="checkbox" className="toggle" checked={settings.auto_schedule_enabled === 'true'} onChange={(e) => update('auto_schedule_enabled', e.target.checked ? 'true' : 'false')} />
              <span className="toggle-label">{settings.auto_schedule_enabled === 'true' ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </div>
        <div className="settings-row">
          <label>Cron Expression</label>
          <div className="field">
            <input type="text" value={settings.auto_schedule_cron || '0 10 * * *'} onChange={(e) => update('auto_schedule_cron', e.target.value)} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>Default: 0 10 * * * (daily at 10:00 UTC)</span>
          </div>
        </div>
        <div className="settings-row">
          <label>Auto Scene Matching</label>
          <div className="field">
            <div className="toggle-wrap">
              <input type="checkbox" className="toggle" checked={settings.auto_scene_matching === 'true'} onChange={(e) => update('auto_scene_matching', e.target.checked ? 'true' : 'false')} />
              <span className="toggle-label">{settings.auto_scene_matching === 'true' ? 'AI finds matching clips per scene' : 'Single background clip'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section card">
        <h3>🔑 API Keys</h3>
        <div className="settings-row">
          <label>Gemini API Key</label>
          <div className="field" style={{ display: 'flex', gap: 8 }}>
            <input type="password" value={settings.gemini_api_key || ''} onChange={(e) => update('gemini_api_key', e.target.value)} placeholder="AIza..." style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={() => testKey('gemini_api_key')}>Test</button>
          </div>
        </div>
        <div className="settings-row">
          <label>OpenAI API Key</label>
          <div className="field" style={{ display: 'flex', gap: 8 }}>
            <input type="password" value={settings.openai_api_key || ''} onChange={(e) => update('openai_api_key', e.target.value)} placeholder="sk-..." style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={() => testKey('openai_api_key')}>Test</button>
          </div>
        </div>
        <div className="settings-row">
          <label>Brave Search API Key</label>
          <div className="field" style={{ display: 'flex', gap: 8 }}>
            <input type="password" value={settings.brave_api_key || ''} onChange={(e) => update('brave_api_key', e.target.value)} placeholder="BSA..." style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={() => testKey('brave_api_key')}>Test</button>
          </div>
        </div>
        <div className="settings-row">
          <label>AI Model</label>
          <div className="field">
            <select value={settings.ai_model || 'gemini-2.5-flash'} onChange={(e) => update('ai_model', e.target.value)}>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gemini-2.5-flash-lite-preview-06-05">Gemini 2.5 Flash Lite</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
              <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image</option>
            </select>
          </div>
        </div>
        <div className="settings-row">
          <label>Thumbnail Model</label>
          <div className="field">
            <select value={settings.ai_image_model || 'gemini-3.1-flash-image-preview'} onChange={(e) => update('ai_image_model', e.target.value)}>
              <option value="gemini-3.1-flash-image-preview">Nano Banana Pro 2 (Gemini 3.1 Flash)</option>
              <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
            </select>
          </div>
        </div>
      </div>

      <div className="settings-section card">
        <h3>🎤 Default Voice</h3>
        <div className="settings-row">
          <label>Voice</label>
          <div className="field">
            <select value={settings.default_voice || 'en-US-GuyNeural'} onChange={(e) => update('default_voice', e.target.value)}>
              <option value="en-US-GuyNeural">Guy — Deep, authoritative male (default)</option>
              <option value="en-US-ChristopherNeural">Christopher — Energetic male</option>
              <option value="en-US-AndrewMultilingualNeural">Andrew — Clear male</option>
              <option value="en-US-JennyNeural">Jenny — Engaging female</option>
              <option value="en-GB-RyanNeural">Ryan — British male</option>
            </select>
          </div>
        </div>
      </div>

      <div className="settings-section card">
        <h3>📺 YouTube</h3>
        <div className="settings-row">
          <label>Connection Status</label>
          <div className="field">
            <div className="api-key-status">
              <span className={`dot ${youtubeConnected ? 'connected' : 'disconnected'}`}></span>
              <span>{youtubeConnected ? 'Connected' : 'Not connected'}</span>
            </div>
            {!youtubeConnected && (
              <a href="/api/youtube/auth" className="btn btn-youtube" style={{ marginTop: 8, display: 'inline-flex' }}>
                Connect YouTube Channel
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="settings-section card">
        <h3>📂 Gameplay Clips</h3>
        <div className="settings-row">
          <label>Clips Directory</label>
          <div className="field">
            <input type="text" value={settings.gameplay_dir || './media/gameplay'} onChange={(e) => update('gameplay_dir', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="settings-section card">
        <h3>📢 Discord Notifications</h3>
        <div className="settings-row">
          <label>Webhook URL</label>
          <div className="field" style={{ display: 'flex', gap: 8 }}>
            <input type="url" value={settings.discord_webhook_url || ''} onChange={(e) => update('discord_webhook_url', e.target.value)} placeholder="https://discord.com/api/webhooks/..." style={{ flex: 1 }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 32 }}>
        <button className="btn btn-ghost" onClick={loadSettings}>Discard</button>
        <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="settings-section card danger-zone">
        <h3>⚠️ Danger Zone</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-danger" onClick={clearVideos}>🗑 Clear All Videos</button>
          <button className="btn btn-danger" onClick={resetSettings}>↺ Reset Settings</button>
        </div>
      </div>
    </>
  );
}