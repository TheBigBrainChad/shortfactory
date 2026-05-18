import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getDb, updateVideo, updateRun, createRun } from './db.js';
import { generateThumbnailImage } from './ai.js';

const PIPELINE_DIR = process.env.PIPELINE_DIR || path.join(process.cwd(), 'pipeline');
const PYTHON = process.env.PYTHON_PATH || 'python3';
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), 'tmp');
const GAMEPLAY_DIR = process.env.GAMEPLAY_DIR || path.join(process.cwd(), 'media', 'gameplay');
const HOME = process.env.HOME || '/root';
const EXTRA_PATH = `${HOME}/.local/bin:/usr/lib/jellyfin-ffmpeg`;
const LD_PATH = `/usr/lib/jellyfin-ffmpeg/lib`;

const runningProcesses = new Map();

export function startPipeline(videoId, mode = 'manual') {
  const runId = createRun({ video_id: videoId, mode });
  const db = getDb();
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);
  if (!video) throw new Error('Video not found');

  updateVideo(videoId, { status: 'producing' });
  updateRun(runId, { stage: 'tts', progress: 0 });

  runPipelineAsync(videoId, runId, video).catch(err => {
    if (err.message === 'Cancelled') {
      console.log(`Pipeline ${runId} cancelled`);
      updateVideo(videoId, { status: 'draft' });
      updateRun(runId, { status: 'cancelled', error: 'Cancelled by user', completed_at: new Date().toISOString() });
      appendLog(runId, '❌ Pipeline cancelled by user');
    } else {
      console.error('Pipeline error:', err);
      updateVideo(videoId, { status: 'failed', error_message: err.message });
      updateRun(runId, { status: 'failed', error: err.message, completed_at: new Date().toISOString() });
      appendLog(runId, `❌ Pipeline failed: ${err.message}`);
    }
  });

  return runId;
}

export function cancelPipeline(runId) {
  const proc = runningProcesses.get(runId);
  if (proc) {
    try {
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 3000);
    } catch {}
    runningProcesses.delete(runId);
    return true;
  }
  return false;
}

async function runPipelineAsync(videoId, runId, video) {
  const videoDir = path.join(OUTPUT_DIR, videoId);
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

  const scriptFilePath = path.join(videoDir, 'script.txt');
  fs.writeFileSync(scriptFilePath, video.script || '', 'utf-8');

  const audioPath = path.join(videoDir, 'voiceover.mp3');
  const transcriptPath = path.join(videoDir, 'transcript.json');
  const subtitlePath = path.join(videoDir, 'subtitles.ass');
  const videoOutPath = path.join(videoDir, 'output.mp4');
  const thumbPath = path.join(videoDir, 'thumbnail.png');

  const openaiKey = process.env.OPENAI_API_KEY || getDb().prepare("SELECT value FROM settings WHERE key = 'openai_api_key'").get()?.value || '';
  const geminiKey = process.env.GEMINI_API_KEY || getDb().prepare("SELECT value FROM settings WHERE key = 'gemini_api_key'").get()?.value || '';

  const stages = [
    { name: 'tts', label: '🎤 Generating voiceover...', script: 'tts.py', args: ['--script-file', scriptFilePath, '--voice', video.voice, '--output', audioPath, '--rate', '+5%'] },
    { name: 'transcribe', label: '📝 Transcribing...', script: 'transcribe.py', args: ['--audio', audioPath, '--output', transcriptPath], env: { OPENAI_API_KEY: openaiKey } },
    { name: 'subtitles', label: '✨ Creating subtitles...', script: 'subtitles.py', args: ['--transcript', transcriptPath, '--output', subtitlePath] },
    { name: 'render', label: '🎬 Rendering video...', script: 'render.py', args: ['--background', video.background_video || GAMEPLAY_DIR, '--audio', audioPath, '--subtitles', subtitlePath, '--output', videoOutPath] },
    { name: 'thumbnail', label: '🖼 Generating thumbnail...', custom: true }
  ];

  let currentStage = 0;
  for (const stage of stages) {
    updateRun(runId, { stage: stage.name, progress: Math.round((currentStage / 6) * 100) });
    appendLog(runId, stage.label);

    try {
      if (stage.custom) {
        await generateThumbnail(video, thumbPath, runId);
      } else {
        await runPythonScript(runId, stage.script, stage.args, stage.env || {}, (line) => {
          appendLog(runId, line);
        });
      }
    } catch (err) {
      appendLog(runId, `❌ ${stage.name} failed: ${err.message}`);
      updateRun(runId, { status: 'failed', error: `${stage.name}: ${err.message}`, completed_at: new Date().toISOString() });
      updateVideo(videoId, { status: 'failed', error_message: `${stage.name}: ${err.message}` });
      throw err;
    }
    currentStage++;
    updateRun(runId, { progress: Math.round((currentStage / 6) * 100) });
  }

  let duration = 0;
  let fileSize = 0;
  if (fs.existsSync(videoOutPath)) {
    const stats = fs.statSync(videoOutPath);
    fileSize = Math.round(stats.size / (1024 * 1024) * 10) / 10;
  }
  if (fs.existsSync(transcriptPath)) {
    try {
      const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
      duration = transcript.duration || 0;
    } catch {}
  }

  updateVideo(videoId, {
    status: 'produced',
    video_path: videoOutPath,
    audio_path: audioPath,
    subtitle_path: subtitlePath,
    thumbnail_path: thumbPath,
    duration: Math.round(duration * 10) / 10,
    file_size: fileSize
  });

  updateRun(runId, {
    stage: 'done',
    status: 'completed',
    progress: 100,
    completed_at: new Date().toISOString()
  });

  appendLog(runId, '✅ Pipeline completed successfully!');

  return { videoId, runId, videoPath: videoOutPath };
}

async function generateThumbnail(video, thumbPath, runId) {
  try {
    const result = await generateThumbnailImage(video.title, video.topic);
    if (result && result.buffer) {
      fs.writeFileSync(thumbPath, result.buffer);
      appendLog(runId, '🖼 AI thumbnail generated');
      return;
    }
  } catch (err) {
    appendLog(runId, `⚠ AI thumbnail failed: ${err.message}, using fallback`);
  }

  await runPythonScript(runId, 'thumbnail.py', [
    '--video', video.video_path || '',
    '--title', video.title,
    '--output', thumbPath
  ], {}, (line) => appendLog(runId, line));
}

function runPythonScript(runId, script, args, env, onLine) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PIPELINE_DIR, script);
    const proc = spawn(PYTHON, [scriptPath, ...args], {
      env: { ...process.env, ...env, PATH: `${EXTRA_PATH}:${process.env.PATH}`, LD_LIBRARY_PATH: `${LD_PATH}:${process.env.LD_LIBRARY_PATH || ''}` },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    runningProcesses.set(runId, proc);

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach(line => onLine && onLine(line));
    });

    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach(line => onLine && onLine(`[stderr] ${line}`));
    });

    proc.on('close', (code) => {
      runningProcesses.delete(runId);
      if (code !== 0) {
        reject(new Error(`Python script ${script} exited with code ${code}`));
      } else {
        resolve();
      }
    });

    proc.on('error', (err) => {
      runningProcesses.delete(runId);
      reject(new Error(`Failed to start ${script}: ${err.message}`));
    });
  });
}

function appendLog(runId, line) {
  const db = getDb();
  const run = db.prepare('SELECT logs FROM runs WHERE id = ?').get(runId);
  if (!run) return;
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const newLog = run.logs ? `${run.logs}\n[${timestamp}] ${line}` : `[${timestamp}] ${line}`;
  db.prepare('UPDATE runs SET logs = ? WHERE id = ?').run(newLog, runId);
}

export function getPipelineStatus(runId) {
  const db = getDb();
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId);
  if (!run) return null;
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(run.video_id);
  return { run, video };
}
