import { NextResponse } from 'next/server';
import { getVideo } from '../../../../../lib/db.js';
import { authenticate } from '../../../../../lib/auth.js';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const video = getVideo(params.id);
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    if (!video.video_path) return NextResponse.json({ error: 'No video file' }, { status: 400 });

    if (!fs.existsSync(video.video_path)) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
    }

    const buffer = fs.readFileSync(video.video_path);
    const filename = `${(video.title || 'video').replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;

    return new Response(buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString()
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}