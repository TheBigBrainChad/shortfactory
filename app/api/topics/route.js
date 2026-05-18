import { NextResponse } from 'next/server';
import { authenticate } from '../../../lib/auth.js';
import { generateTopics } from '../../../lib/ai.js';
import { getDb } from '../../../lib/db.js';

export async function GET(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getDb();
    const topics = db.prepare("SELECT * FROM topics WHERE used = 0 ORDER BY score DESC LIMIT 20").all();
    return NextResponse.json({ topics });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const count = body?.count || 8;
    let newTopics;
    try {
      newTopics = await generateTopics(count);
    } catch (aiErr) {
      console.error('AI topic generation failed:', aiErr);
      return NextResponse.json({ error: `AI generation failed: ${aiErr.message}` }, { status: 500 });
    }

    const db = getDb();
    const saved = newTopics.map(t => {
      const result = db.prepare(
        "INSERT INTO topics (title, category, score, hook, reason) VALUES (?, ?, ?, ?, ?)"
      ).run(t.title, t.category, t.score || 50, t.hook || '', t.reason || '');
      return { id: result.lastInsertRowid, ...t };
    });

    return NextResponse.json({ topics: saved });
  } catch (err) {
    console.error('Topics POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}