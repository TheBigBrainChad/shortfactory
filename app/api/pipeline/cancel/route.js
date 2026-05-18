import { NextResponse } from 'next/server';
import { authenticate } from '../../../../lib/auth.js';
import { cancelPipeline } from '../../../../lib/pipeline.js';

export async function POST(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { runId } = body;
    if (!runId) return NextResponse.json({ error: 'Missing runId' }, { status: 400 });

    const cancelled = cancelPipeline(runId);
    return NextResponse.json({ success: cancelled });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
