import { NextResponse } from 'next/server';
import { authenticate } from '../../../../lib/auth.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const MEDIA_DIR = process.env.GAMEPLAY_DIR || path.join(process.cwd(), 'media', 'gameplay');
const YT_DLP = process.env.YTDLP_PATH || 'yt-dlp';

export async function POST(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { url, videoId } = body;

    if (!url && !videoId) {
      return NextResponse.json({ error: 'Provide url or videoId' }, { status: 400 });
    }

    const targetUrl = url || `https://www.youtube.com/watch?v=${videoId}`;

    if (!fs.existsSync(MEDIA_DIR)) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true });
    }

    const ytVideoId = videoId || extractVideoId(targetUrl);
    const outputTemplate = path.join(MEDIA_DIR, '%(id)s.%(ext)s');

    const args = [
      '--no-warnings',
      '--no-check-certificates',
      '--js-runtimes', 'node',
      '--remote-components', 'ejs:github',
      '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
      '--merge-output-format', 'mp4',
      '-o', outputTemplate,
      '--max-filesize', '500M',
      '--socket-timeout', '30',
      '--retries', '3',
      targetUrl
    ];

    let stdout = '';
    let stderr = '';

    await new Promise((resolve, reject) => {
      const proc = spawn(YT_DLP, args, {
        env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`, YTDLP_JS_RUNTIMES: 'node', YTDLP_REMOTE_COMPONENTS: 'ejs:github' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr.slice(-500)}`));
        } else {
          resolve();
        }
      });
      proc.on('error', (err) => reject(err));
    });

    const downloadedFile = findDownloadedFile(MEDIA_DIR, ytVideoId);
    if (!downloadedFile) {
      return NextResponse.json({ error: 'Download completed but file not found', stdout, stderr }, { status: 500 });
    }

    const stats = fs.statSync(downloadedFile);
    const filename = path.basename(downloadedFile);

    const allFiles = fs.readdirSync(MEDIA_DIR).filter(f =>
      f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm')
    );

    return NextResponse.json({
      success: true,
      path: downloadedFile,
      filename,
      size: Math.round(stats.size / (1024 * 1024) * 10) / 10,
      availableBackgrounds: allFiles
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!fs.existsSync(MEDIA_DIR)) {
    return NextResponse.json({ backgrounds: [] });
  }

  const files = fs.readdirSync(MEDIA_DIR)
    .filter(f => f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm'))
    .map(f => {
      const stats = fs.statSync(path.join(MEDIA_DIR, f));
      return { filename: f, path: path.join(MEDIA_DIR, f), size: Math.round(stats.size / (1024 * 1024) * 10) / 10 };
    });

  return NextResponse.json({ backgrounds: files });
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    return url.split('/').pop()?.split('?')[0] || '';
  }
}

function findDownloadedFile(dir, videoId) {
  const extensions = ['mp4', 'mkv', 'webm'];
  for (const ext of extensions) {
    const candidate = path.join(dir, `${videoId}.${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  const mostRecent = fs.readdirSync(dir)
    .filter(f => f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm'))
    .map(f => ({ f, time: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  return mostRecent.length > 0 ? path.join(dir, mostRecent[0].f) : null;
}