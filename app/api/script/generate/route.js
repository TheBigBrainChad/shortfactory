import { NextResponse } from 'next/server';
import { authenticate } from '../../../../lib/auth.js';
import { generateScript, generateScriptVariants, generateTitleDescription } from '../../../../lib/ai.js';

export async function POST(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { topic, hook, variants } = await request.json();
    if (!topic) return NextResponse.json({ error: 'Topic required' }, { status: 400 });

    if (variants) {
      const items = await generateScriptVariants(topic, hook);
      return NextResponse.json({ variants: items });
    }

    const script = await generateScript(topic, hook);

    let title, description, tags;
    try {
      const metadata = await generateTitleDescription(script, topic);
      title = metadata.title;
      description = metadata.description;
      tags = metadata.tags;
    } catch {
      title = topic;
      description = '';
      tags = [];
    }

    return NextResponse.json({ script, title, description, tags });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}