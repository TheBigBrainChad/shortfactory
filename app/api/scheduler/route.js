import { NextResponse } from 'next/server';
import { authenticate } from '../../../lib/auth.js';
import { getSchedulerStatus, triggerAutoProduction, updateScheduler } from '../../../lib/scheduler.js';

export async function GET(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const status = getSchedulerStatus();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    if (body.action === 'trigger') {
      const result = await triggerAutoProduction();
      return NextResponse.json(result);
    }

    if (body.action === 'update' && body.cron) {
      updateScheduler(body.cron);
      return NextResponse.json({ success: true, cron: body.cron });
    }

    if (body.action === 'start') {
      const { startScheduler } = await import('../../../lib/scheduler.js');
      startScheduler();
      return NextResponse.json({ success: true, message: 'Scheduler started' });
    }

    if (body.action === 'stop') {
      const { stopScheduler } = await import('../../../lib/scheduler.js');
      stopScheduler();
      return NextResponse.json({ success: true, message: 'Scheduler stopped' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}