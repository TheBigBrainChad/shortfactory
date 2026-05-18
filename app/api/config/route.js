import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    gemini_api_key: !!(process.env.GEMINI_API_KEY),
    openai_api_key: !!(process.env.OPENAI_API_KEY),
    brave_api_key: !!(process.env.BRAVE_API_KEY),
    youtube_connected: !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET)
  };
  return NextResponse.json(config);
}