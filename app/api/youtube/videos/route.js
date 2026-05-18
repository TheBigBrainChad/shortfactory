import { NextResponse } from 'next/server';
import { authenticate } from '../../../../lib/auth.js';
import { getChannelVideos } from '../../../../lib/youtube.js';

export async function GET(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const videos = await getChannelVideos(50);
    return NextResponse.json({ videos });
  } catch (err) {
    return NextResponse.json({ videos: [], error: err.message }, { status: 500 });
  }
}