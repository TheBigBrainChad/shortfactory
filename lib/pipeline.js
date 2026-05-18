import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getDb, updateVideo, updateRun, createRun } from './db.js';
import { generateThumbnailImage, generateBackgroundQuery, pickBestBackground, generateSceneQueries, generateSceneSegments } from './ai.js';

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

export async function autoDownloadBackground(topic, script, videoId) {
  try {
    const query = await generateBackgroundQuery(topic, script);
    console.log(`[Auto Background] Searching: ${query}`);

    const braveKey = process.env.BRAVE_API_KEY || getDb().prepare("SELECT value FROM settings WHERE key = 'brave_api_key'").get()?.value || '';
    if (!braveKey) throw new Error('No Brave API key configured');

    const searchRes = await fetch(`https://api.search.brave.com/res/v1/videos/search?q=${encodeURIComponent(query)}&count=5&offset=0`, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveKey }
    });

    if (!searchRes.ok) throw new Error(`Brave search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    const results = (searchData.results || []).filter(r => r.url && r.url.includes('youtube.com/watch')).map(r => {
      const match = r.url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      return match ? { videoId: match[1], title: r.title || '', channel: r.meta?.channel?.name || '' } : null;
    }).filter(Boolean);

    if (results.length === 0) throw new Error('No matching background videos found');

    const best = await pickBestBackground(results, topic, script);
    console.log(`[Auto Background] Selected: ${best.title} (${best.videoId})`);

    const downloadRes = await downloadYoutubeVideo(best.videoId);
    if (downloadRes) {
      updateVideo(videoId, { background_video: downloadRes.path, background_source: 'auto' });
      console.log(`[Auto Background] Downloaded to: ${downloadRes.path}`);
      return downloadRes.path;
    }
    throw new Error('Download failed');
  } catch (err) {
    console.error('[Auto Background] Failed:', err.message);
    return null;
  }
}

async function downloadYoutubeVideo(videoId) {
  const ytDlp = path.join(HOME, '.local', 'bin', 'yt-dlp');
  const outputDir = GAMEPLAY_DIR;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${videoId}.mp4`);
  if (fs.existsSync(outputPath)) {
    return { path: outputPath, filename: `${videoId}.mp4` };
  }

  const cmd = [
    ytDlp,
    '--no-playlist',
    '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
    '--merge-output-format', 'mp4',
    '--max-filesize', '500M',
    '-o', outputPath,
    `https://www.youtube.com/watch?v=${videoId}`
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd[0], cmd.slice(1), {
      env: { ...process.env, PATH: `${EXTRA_PATH}:${process.env.PATH}` },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({ path: outputPath, filename: `${videoId}.mp4` });
      } else {
        reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 200)}`));
      }
    });
    proc.on('error', (err) => reject(err));
  });
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
  const sceneBgPath = path.join(videoDir, 'scene_background.mp4');

  const openaiKey = process.env.OPENAI_API_KEY || getDb().prepare("SELECT value FROM settings WHERE key = 'openai_api_key'").get()?.value || '';
  const braveKey = process.env.BRAVE_API_KEY || getDb().prepare("SELECT value FROM settings WHERE key = 'brave_api_key'").get()?.value || '';

  const useSceneMatch = video.scene_matching === 1 || video.scene_matching === 'true';
  let backgroundArg = video.background_video || GAMEPLAY_DIR;

  const baseStages = [
    { name: 'tts', label: '🎤 Generating voiceover...', script: 'tts.py', args: ['--script-file', scriptFilePath, '--voice', video.voice, '--output', audioPath, '--rate', '+5%'] },
    { name: 'transcribe', label: '📝 Transcribing...', script: 'transcribe.py', args: ['--audio', audioPath, '--output', transcriptPath], env: { OPENAI_API_KEY: openaiKey } },
  ];

  let stages = [...baseStages];

  // Scene matching: AI reads whole script, divides into segments, downloads matching clips
  if (useSceneMatch && braveKey) {
    stages.push({
      name: 'scene_match',
      label: '🎬 Finding matching scenes...',
      custom: true,
      fn: async () => {
        appendLog(runId, '🎬 AI analyzing script for visual segments...');
        const aiSegments = await generateSceneSegments(video.script || video.topic);
        appendLog(runId, `   ${aiSegments.length} visual segments identified`);

        const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
        const words = transcript.words || [];

        // Map AI word indices to transcript timing
        const segmentsWithTiming = aiSegments.map((seg, i) => {
          const startIdx = Math.min(seg.start_word, words.length - 1);
          const endIdx = Math.min(seg.end_word - 1, words.length - 1);
          return {
            index: i,
            start: words[startIdx]?.start || 0,
            end: words[endIdx]?.end || (words[startIdx]?.start || 0) + 3,
            query: seg.query
          };
        });

        const segmentsPath = path.join(videoDir, 'scene_segments.json');
        fs.writeFileSync(segmentsPath, JSON.stringify(segmentsWithTiming, null, 2));

        appendLog(runId, '🎬 Downloading and assembling scenes...');
        try {
          await runPythonScript(runId, 'scene_match.py', [
            '--segments', segmentsPath,
            '--output', sceneBgPath,
            '--brave-key', braveKey
          ], {}, (line) => appendLog(runId, line));

          if (fs.existsSync(sceneBgPath)) {
            backgroundArg = sceneBgPath;
            appendLog(runId, '✅ Scene-matched background assembled');
          } else {
            throw new Error('Scene matching produced no output');
          }
        } catch (err) {
          appendLog(runId, `❌ Scene matching failed: ${err.message}`);
          // If user selected a specific background in Studio, keep it. Otherwise fail.
          if (!video.background_video || video.background_source === 'auto') {
            throw new Error('Smart Scenes failed and no fallback background is selected. Please select a background in Studio or disable Smart Scenes.');
          }
          appendLog(runId, '⚠️ Falling back to selected background');
        }
      }
    });
  }

  stages.push(
    { name: 'subtitles', label: '✨ Creating subtitles...', script: 'subtitles.py', args: ['--transcript', transcriptPath, '--output', subtitlePath] },
    { name: 'render', label: '🎬 Rendering video...', script: 'render.py', args: ['--background', backgroundArg, '--audio', audioPath, '--subtitles', subtitlePath, '--output', videoOutPath] },
    { name: 'thumbnail', label: '🖼 Generating thumbnail...', custom: true }
  );

  let currentStage = 0;
  for (const stage of stages) {
    updateRun(runId, { stage: stage.name, progress: Math.round((currentStage / 6) * 100) });
    appendLog(runId, stage.label);

    try {
      if (stage.custom && stage.fn) {
        await stage.fn();
      } else if (stage.custom) {
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
