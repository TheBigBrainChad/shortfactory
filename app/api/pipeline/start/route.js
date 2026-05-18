import { NextResponse } from 'next/server';
import { authenticate } from '../../../../lib/auth.js';
import { createVideo, updateVideo } from '../../../../lib/db.js';
import { startPipeline } from '../../../../lib/pipeline.js';

export async function POST(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    let videoId;
    if (body.videoId) {
      videoId = body.videoId;
    } else {
      videoId = createVideo({
        title: body.title || 'Untitled',
        topic: body.topic || '',
        script: body.script || '',
        voice: body.voice || 'en-US-GuyNeural'
      });

      if (body.description) {
        updateVideo(videoId, {
          description: body.description,
          tags: typeof body.tags === 'string' ? body.tags : (body.tags || []).join(',')
        });
      }

      if (body.background_video) {
        updateVideo(videoId, { background_video: body.background_video });
      }
    }

    const runId = startPipeline(videoId, body.mode || 'manual');
    return NextResponse.json({ videoId, runId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}