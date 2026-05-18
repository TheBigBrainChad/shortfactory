import { NextResponse } from 'next/server';
import { authenticate } from '../../../../lib/auth.js';
import { getAnalyticsMetrics } from '../../../../lib/youtube.js';

export async function GET(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const dimensions = searchParams.get('dimensions') || 'day';
    const startDate = searchParams.get('startDate') || '2025-01-01';
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const data = await getAnalyticsMetrics(dimensions, startDate, endDate);
    if (!data) {
      return NextResponse.json({ rows: [], error: 'YouTube not connected or no data' });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ rows: [], error: err.message }, { status: 500 });
  }
}