import { NextResponse } from 'next/server';
import { authenticate } from '../../../../../lib/auth.js';
import { getPipelineStatus } from '../../../../../lib/pipeline.js';

export async function GET(request, { params }) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const status = getPipelineStatus(params.runId);
    if (!status) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}