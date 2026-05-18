import { NextResponse } from 'next/server';
import { authenticate } from '../../../lib/auth.js';
import { getAllSettings, setSetting, getDb } from '../../../lib/db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ENV_DEFAULTS = {
  gemini_api_key: process.env.GEMINI_API_KEY || '',
  openai_api_key: process.env.OPENAI_API_KEY || '',
  brave_api_key: process.env.BRAVE_API_KEY || '',
  ai_model: process.env.AI_MODEL || 'gemini-2.5-flash',
  ai_image_model: process.env.AI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview',
  default_voice: process.env.DEFAULT_VOICE || 'en-US-GuyNeural',
  auto_schedule_enabled: process.env.AUTO_SCHEDULE_ENABLED || 'false',
  auto_schedule_cron: process.env.AUTO_SCHEDULE_CRON || '0 10 * * *',
  gameplay_dir: process.env.GAMEPLAY_DIR || './media/gameplay',
  discord_webhook_url: process.env.DISCORD_WEBHOOK_URL || '',
  youtube_client_id: process.env.YOUTUBE_CLIENT_ID || '',
  youtube_client_secret: process.env.YOUTUBE_CLIENT_SECRET || '',
};

export async function GET(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const dbSettings = getAllSettings();
    const settings = { ...ENV_DEFAULTS, ...dbSettings };
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const allowedKeys = [
      'gemini_api_key', 'openai_api_key', 'brave_api_key',
      'ai_model', 'ai_image_model', 'default_voice',
      'auto_schedule_enabled', 'auto_schedule_cron',
      'gameplay_dir', 'discord_webhook_url',
      'youtube_client_id', 'youtube_client_secret'
    ];

    for (const [key, value] of Object.entries(body)) {
      if (allowedKeys.includes(key)) {
        setSetting(key, String(value));
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    if (body.action === 'test_key') {
      const key = body.key;
      const value = body.value;
      const settings = getAllSettings();
      const keyValue = (value || settings[key] || process.env[key.toUpperCase()] || '').trim();

      if (!keyValue) {
        return NextResponse.json({ valid: false, error: 'No key provided' });
      }

      if (key === 'gemini_api_key') {
        try {
          const gen = new GoogleGenerativeAI(keyValue);
          const model = gen.getGenerativeModel({ model: 'gemini-2.5-flash' });
          await model.generateContent('Hi');
          return NextResponse.json({ valid: true });
        } catch (err) {
          return NextResponse.json({ valid: false, error: err.message || 'Invalid API key' });
        }
      }

      if (key === 'openai_api_key') {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${keyValue}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: 'Hi' }],
              max_tokens: 1
            })
          });
          if (response.ok || response.status === 200) {
            return NextResponse.json({ valid: true });
          }
          const errBody = await response.text();
          return NextResponse.json({ valid: false, error: `HTTP ${response.status}: ${errBody.slice(0, 100)}` });
        } catch (err) {
          return NextResponse.json({ valid: false, error: 'Connection failed' });
        }
      }

      return NextResponse.json({ valid: !!keyValue });
    }

    if (body.action === 'clear_videos') {
      const db = getDb();
      db.exec("DELETE FROM videos");
      db.exec("DELETE FROM runs");
      return NextResponse.json({ success: true });
    }

    if (body.action === 'reset') {
      const db = getDb();
      db.exec("DELETE FROM settings");
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}