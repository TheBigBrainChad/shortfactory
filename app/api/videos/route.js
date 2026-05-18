import { NextResponse } from 'next/server';
import { getVideos, getStats, getVideoCount, getRecentRuns, getTodayVideoCount } from '../../../lib/db.js';
import { authenticate } from '../../../lib/auth.js';
import { uploadVideo } from '../../../lib/youtube.js';
import { startPipeline } from '../../../lib/pipeline.js';
import { updateVideo } from '../../../lib/db.js';

export async function GET(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const stats = searchParams.get('stats');
    const runs = searchParams.get('runs');
    const status = searchParams.get('status') || '';
    const limit = parseInt(searchParams.get('limit') || '50');

    if (stats) {
      const s = getStats();
      const todayCount = getTodayVideoCount();
      return NextResponse.json({ ...s, todayCount });
    }

    if (runs) {
      const recentRuns = getRecentRuns(20);
      return NextResponse.json({ runs: recentRuns });
    }

    const videos = getVideos({ status: status || undefined, limit });
    return NextResponse.json({ videos });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    if (body.action === 'upload' && body.videoId) {
      const video = getVideos({ limit: 1 }).find(v => v.id === body.videoId);
      if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
      if (!video.video_path) return NextResponse.json({ error: 'Video file not found' }, { status: 400 });

      const result = await uploadVideo({
        videoPath: video.video_path,
        title: video.title,
        description: video.description,
        tags: video.tags,
        thumbnailPath: video.thumbnail_path
      });

      updateVideo(video.id, {
        status: 'uploaded',
        youtube_id: result.videoId,
        youtube_url: result.youtubeUrl
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}