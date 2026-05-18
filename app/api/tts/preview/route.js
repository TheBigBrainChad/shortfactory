import { NextResponse } from 'next/server';
import { authenticate } from '../../../../lib/auth.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const voice = searchParams.get('voice') || 'en-US-GuyNeural';
    const text = searchParams.get('text') || 'This is a voice preview for your Short video.';

    const tmpDir = path.join(os.tmpdir(), 'sf-tts-preview-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'preview.mp3');

    const proc = spawn('edge-tts', [
      '--voice', voice,
      '--text', text,
      '--write-media', outputPath,
      '--rate', '+5%'
    ], { timeout: 15000 });

    await new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`edge-tts exited with code ${code}`));
      });
      proc.on('error', reject);
    });

    const buffer = fs.readFileSync(outputPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
