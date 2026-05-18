import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'shortfactory.db');

let _db = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const subdirs = ['videos', 'audio', 'thumbnails', 'scripts'];
  subdirs.forEach(d => {
    const p = path.join(DATA_DIR, d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
}

export function getDb() {
  if (_db) return _db;
  ensureDataDir();
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      script TEXT DEFAULT '',
      topic TEXT DEFAULT '',
      voice TEXT DEFAULT 'en-US-GuyNeural',
      status TEXT DEFAULT 'draft',
      youtube_url TEXT,
      youtube_id TEXT,
      thumbnail_path TEXT,
      video_path TEXT,
      audio_path TEXT,
      subtitle_path TEXT,
      duration REAL DEFAULT 0,
      file_size INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      auto_triggered INTEGER DEFAULT 0,
      background_video TEXT,
      background_source TEXT,
      caption_style TEXT DEFAULT 'boxed',
      scene_matching INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      video_id TEXT,
      mode TEXT DEFAULT 'manual',
      stage TEXT DEFAULT 'pending',
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      logs TEXT DEFAULT '',
      error TEXT,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (video_id) REFERENCES videos(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT DEFAULT '',
      score REAL DEFAULT 0,
      hook TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const cols = db.prepare("PRAGMA table_info(videos)").all();
  if (!cols.some(c => c.name === 'caption_style')) {
    db.exec("ALTER TABLE videos ADD COLUMN caption_style TEXT DEFAULT 'boxed'");
  }
  if (!cols.some(c => c.name === 'scene_matching')) {
    db.exec("ALTER TABLE videos ADD COLUMN scene_matching INTEGER DEFAULT 0");
  }
}

export function generateId() {
  return crypto.randomUUID().slice(0, 12);
}

export function createVideo({ title, topic, script, voice, auto_triggered = 0, scene_matching = 0, background_video, background_source }) {
  const db = getDb();
  const id = generateId();
  db.prepare(
    `INSERT INTO videos (id, title, topic, script, voice, auto_triggered, scene_matching, background_video, background_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, title, topic || '', script || '', voice || 'en-US-GuyNeural', auto_triggered, scene_matching || 0, background_video || null, background_source || null);
  return id;
}

export function updateVideo(id, updates) {
  const db = getDb();
  updates.updated_at = new Date().toISOString();
  const keys = Object.keys(updates);
  const setClause = keys.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE videos SET ${setClause} WHERE id = @id`).run({ id, ...updates });
}

export function getVideo(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM videos WHERE id = ?').get(id);
}

export function getVideos({ status, limit = 50, offset = 0 } = {}) {
  const db = getDb();
  if (status) {
    return db.prepare('SELECT * FROM videos WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(status, limit, offset);
  }
  return db.prepare('SELECT * FROM videos ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
}

export function deleteVideo(id) {
  const db = getDb();
  db.prepare('DELETE FROM videos WHERE id = ?').run(id);
  db.prepare('DELETE FROM runs WHERE video_id = ?').run(id);
}

export function getVideoCount() {
  const db = getDb();
  return db.prepare('SELECT COUNT(*) as count FROM videos').get().count;
}

export function getStats() {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM videos').get().count;
  const uploaded = db.prepare("SELECT COUNT(*) as count FROM videos WHERE status = 'uploaded'").get().count;
  const failed = db.prepare("SELECT COUNT(*) as count FROM videos WHERE status = 'failed'").get().count;
  const drafts = db.prepare("SELECT COUNT(*) as count FROM videos WHERE status = 'draft'").get().count;
  const views = db.prepare('SELECT COALESCE(SUM(view_count), 0) as total FROM videos').get().total;
  return { total, uploaded, failed, drafts, totalViews: views };
}

export function getTodayVideoCount() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  return db.prepare("SELECT COUNT(*) as count FROM videos WHERE date(created_at) = ?").get(today).count;
}

export function createRun({ video_id, mode = 'manual' }) {
  const db = getDb();
  const id = generateId();
  db.prepare(
    `INSERT INTO runs (id, video_id, mode, stage, status, started_at) VALUES (?, ?, ?, 'pending', 'running', datetime('now'))`
  ).run(id, video_id, mode);
  return id;
}

export function updateRun(id, updates) {
  const db = getDb();
  const keys = Object.keys(updates);
  const setClause = keys.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE runs SET ${setClause} WHERE id = @id`).run({ id, ...updates });
}

export function getRun(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM runs WHERE id = ?').get(id);
}

export function getRecentRuns(limit = 10) {
  const db = getDb();
  return db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT ?').all(limit);
}

export function getSetting(key, defaultValue = null) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

export function setSetting(key, value) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}