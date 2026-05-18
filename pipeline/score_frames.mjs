import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error(JSON.stringify({ error: 'GEMINI_API_KEY not set' }));
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    montage: get('--montage'),
    query: get('--query'),
    count: parseInt(get('--count') || '10'),
    model: process.env.AI_MODEL || 'gemini-2.5-flash'
  };
}

async function scoreMontage(montagePath, query, frameCount, modelName) {
  const client = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = client.getGenerativeModel({ model: modelName });

  const imageBuffer = fs.readFileSync(montagePath);
  const base64Data = imageBuffer.toString('base64');

  const prompt = `This image is a grid of frames from a video. The frames were captured every 5 seconds, reading left-to-right, top-to-bottom. There are ${frameCount} frames total. Frame 0 is the top-left frame. Any black/empty tiles at the end should be ignored.

Your task: identify which frame best visually represents this description: "${query}"

Return ONLY a JSON object with:
- best_index: the frame number (0-indexed, starting from top-left)
- confidence: your confidence 0-100

Example: {"best_index": 3, "confidence": 85}`;

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
      ]
    }]
  });

  const text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) throw new Error('Failed to parse score response');
  return JSON.parse(jsonMatch[0]);
}

const { montage, query, count, model } = parseArgs();

if (!montage || !query) {
  console.error(JSON.stringify({ error: 'Usage: node score_frames.mjs --montage <path> --query <text> --count <n>' }));
  process.exit(1);
}

try {
  const result = await scoreMontage(montage, query, count, model);
  console.log(JSON.stringify(result));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
