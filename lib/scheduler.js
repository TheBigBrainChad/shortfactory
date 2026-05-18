import cron from 'node-cron';
import { getDb, createVideo, updateVideo } from './db.js';
import { generateTopics, generateScript, generateTitleDescription } from './ai.js';
import { startPipeline } from './pipeline.js';

let scheduledTask = null;
let isRunning = false;

export function startScheduler() {
  const db = getDb();
  const enabled = db.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
  if (enabled?.value !== 'true' && !process.env.AUTO_SCHEDULE_ENABLED === 'true') return;

  const cronExpr = db.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_cron'").get()?.value
    || process.env.AUTO_SCHEDULE_CRON
    || '0 10 * * *';

  stopScheduler();

  try {
    scheduledTask = cron.schedule(cronExpr, async () => {
      if (isRunning) return;
      await triggerAutoProduction();
    }, { timezone: 'UTC' });
    console.log(`Scheduler started: ${cronExpr}`);
  } catch (err) {
    console.error('Invalid cron expression:', err.message);
  }
}

export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

export function updateScheduler(cronExpr) {
  stopScheduler();
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_cron', ?)").run(cronExpr);
  startScheduler();
}

export async function triggerAutoProduction() {
  if (isRunning) return { error: 'Pipeline already running' };
  isRunning = true;

  try {
    const db = getDb();
    let topic = null;

    const unusedTopics = db.prepare("SELECT * FROM topics WHERE used = 0 ORDER BY score DESC LIMIT 1").all();
    if (unusedTopics.length > 0) {
      topic = unusedTopics[0];
    } else {
      const newTopics = await generateTopics(5);
      if (newTopics.length > 0) {
        topic = newTopics[0];
        newTopics.forEach(t => {
          db.prepare("INSERT INTO topics (title, category, score) VALUES (?, ?, ?)").run(t.title, t.category, t.score || 50);
        });
      }
    }

    if (!topic) throw new Error('No topic available');

    const script = await generateScript(topic.title, topic.hook);
    const metadata = await generateTitleDescription(script, topic.title);

    const videoId = createVideo({
      title: metadata.title,
      topic: topic.title,
      script: script,
      voice: db.prepare("SELECT value FROM settings WHERE key = 'default_voice'").get()?.value || process.env.DEFAULT_VOICE || 'en-US-GuyNeural',
      auto_triggered: 1
    });

    updateVideo(videoId, {
      description: metadata.description,
      tags: Array.isArray(metadata.tags) ? metadata.tags.join(',') : metadata.tags
    });

    db.prepare("UPDATE topics SET used = 1 WHERE id = ?").run(topic.id);

    const runId = startPipeline(videoId, 'auto');
    return { videoId, runId };
  } catch (err) {
    console.error('Auto production failed:', err);
    throw err;
  } finally {
    isRunning = false;
  }
}

export function getSchedulerStatus() {
  const db = getDb();
  const enabled = db.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get()?.value || 'false';
  const cronExpr = db.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_cron'").get()?.value || process.env.AUTO_SCHEDULE_CRON || '0 10 * * *';

  let nextRun = null;
  if (enabled === 'true' && scheduledTask) {
    try {
      nextRun = cron.getNextDate(cronExpr).toDate().toISOString();
    } catch {}
  }

  return { enabled: enabled === 'true', cron: cronExpr, nextRun, isRunning };
}