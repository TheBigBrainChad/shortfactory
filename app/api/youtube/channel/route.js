import { NextResponse } from 'next/server';
import { authenticate } from '../../../../lib/auth.js';
import { getChannelInfo } from '../../../../lib/youtube.js';

export async function GET(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const channelInfo = await getChannelInfo();
    if (!channelInfo) {
      return NextResponse.json({ connected: false });
    }
    return NextResponse.json(channelInfo);
  } catch (err) {
    return NextResponse.json({ connected: false, error: err.message }, { status: 200 });
  }
}