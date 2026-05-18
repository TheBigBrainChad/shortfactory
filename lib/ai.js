import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSetting } from './db.js';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY || getSetting('gemini_api_key');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenerativeAI(apiKey);
}

function getModel(modelOverride) {
  const client = getClient();
  const model = modelOverride || process.env.AI_MODEL || getSetting('ai_model') || 'gemini-2.5-flash';
  return client.getGenerativeModel({ model });
}

export async function generateTopics(count = 8) {
  const gen = getModel();
  const prompt = `Generate ${count} trending YouTube Shorts topics in the "brainrot edutainment" niche. These should be fascinating facts, mysteries, or "did you know" style content that stops the scroll.

For each topic, provide:
- title: catchy, curiosity-driven (10 words max)
- category: one of Science, History, Nature, Tech, Psychology, Space, Weird, Health
- reason: why this would go viral (1 sentence)
- hook: a 5-8 word opening hook

Return ONLY a valid JSON array, no markdown: [{"title":"...", "category":"...", "reason":"...", "hook":"..."}, ...]`;

  const result = await gen.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Failed to parse topics from AI response: ' + text.substring(0, 200));
  return JSON.parse(jsonMatch[0]);
}

export async function generateScript(topic, hook) {
  const gen = getModel();
  const prompt = `Write a YouTube Shorts script about: "${topic}"
${hook ? `Opening hook: "${hook}"` : ''}

Rules:
- Follow the Hook → Story → CTA formula
- Hook (0-3s): Attention-grabbing opener that stops the scroll
- Body (3-45s): Rapid-fire punchy sentences, max 15 words each, 6th grade vocabulary
- CTA (45-55s): Cliffhanger or "Follow for more insane facts"
- Target 120-150 words total (45-55 seconds spoken)
- Use "..." for dramatic pauses
- Don't say the title, just dive into the content
- Write in second person ("you") for engagement

Return ONLY the script text, no formatting, no labels, no metadata.`;

  const result = await gen.generateContent(prompt);
  return result.response.text().trim();
}

export async function generateScriptVariants(topic, hook) {
  const gen = getModel();
  const prompt = `Write 3 different YouTube Shorts scripts about: "${topic}"
${hook ? `Suggested hook: "${hook}"` : ''}

Each script must have a completely different angle:
- Script A: Shocking / unbelievable angle ("You won't believe...")
- Script B: Emotional / personal angle ("Imagine if this happened to you...")
- Script C: Fact-packed / listicle angle ("Here are 3 things you didn't know...")

Rules for all:
- Follow Hook → Story → CTA formula
- Hook (0-3s): Attention-grabbing opener
- Body (3-45s): Punchy sentences, max 15 words each, 6th grade vocab
- CTA (45-55s): Cliffhanger or "Follow for more"
- Target 120-150 words (45-55 seconds spoken)
- Use "..." for dramatic pauses
- Write in second person ("you")
- Don't say the title

Return ONLY valid JSON, no markdown:
[
  {"label":"A","angle":"Shocking","hook":"...","script":"..."},
  {"label":"B","angle":"Emotional","hook":"...","script":"..."},
  {"label":"C","angle":"Fact-Packed","hook":"...","script":"..."}
]`;

  const result = await gen.generateContent(prompt);
  let text = result.response.text().trim();
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Failed to parse variants from AI response');
  return JSON.parse(jsonMatch[0]);
}

export async function generateTitleDescription(script, topic) {
  const gen = getModel();
  const prompt = `Given this YouTube Shorts script about "${topic}":

"""
${script}
"""

Generate SEO-optimized metadata. Return ONLY valid JSON, no markdown:
{
  "title": "catchy YouTube title, 50 chars max, use emojis",
  "description": "2-3 line description with hashtags",
  "tags": ["tag1", "tag2", ...tag8]
}`;

  const result = await gen.generateContent(prompt);
  let text = result.response.text().trim();
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse metadata from AI response');
  return JSON.parse(jsonMatch[0]);
}

export async function generateThumbnailPrompt(title, topic) {
  const gen = getModel();
  const prompt = `Create a detailed image generation prompt for a YouTube Shorts thumbnail (1080x1920 vertical).

Video title: "${title}"
Topic: "${topic}"

The thumbnail should be eye-catching, bold, vibrant. Include text overlay with the key phrase. Use dramatic colors, high contrast.

Return ONLY the image generation prompt text, nothing else.`;

  const result = await gen.generateContent(prompt);
  return result.response.text().trim();
}

export async function generateThumbnailImage(title, topic) {
  const imageModel = process.env.AI_IMAGE_MODEL || getSetting('ai_image_model') || 'gemini-3.1-flash-image-preview';
  const client = getClient();

  try {
    const model = client.getGenerativeModel({ model: imageModel, generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } });
    const prompt = `Generate a YouTube Shorts thumbnail image (vertical 1080x1920). The video is about: "${title}" (${topic}).

Requirements:
- Bold, eye-catching design with vibrant colors
- Include a text overlay with the key catchphrase from the title
- High contrast, dramatic lighting
- Modern, trendy aesthetic
- No watermarks or logos
- Vertical format (9:16 aspect ratio)`;

    const result = await model.generateContent(prompt);
    const parts = result.response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);
    if (imagePart?.inlineData) {
      return { buffer: Buffer.from(imagePart.inlineData.data, 'base64'), mimeType: imagePart.inlineData.mimeType };
    }
    throw new Error('No image data in response');
  } catch (err) {
    console.error('AI thumbnail generation failed:', err.message);
    return null;
  }
}

export async function generateBackgroundQuery(topic, script) {
  const gen = getModel();
  const prompt = `Given this YouTube Shorts topic and script, generate the perfect YouTube search query to find background footage that matches the subject visually.

Topic: "${topic}"
Script: """${script?.substring(0, 500) || ''}"""

The search query should:
- Be specific to what's happening in the video (not generic "gameplay")
- Include terms like "footage", "visuals", "b-roll", or "scenes"
- Exclude music, commentary, talking heads, or text overlays
- Be under 10 words
- Work well as a YouTube search

Return ONLY the search query string, nothing else.`;

  const result = await gen.generateContent(prompt);
  const query = result.response.text().trim().replace(/["']/g, '');
  return query || `${topic} footage no commentary`;
}

export async function pickBestBackground(results, topic, script) {
  if (!results || results.length === 0) return null;
  if (results.length === 1) return results[0];

  const gen = getModel();
  const prompt = `Given this YouTube Shorts topic and ${results.length} background video options, pick the best one by returning ONLY its index number (0, 1, 2, etc.).

Topic: "${topic}"
Script excerpt: """${script?.substring(0, 300) || ''}"""

Options:
${results.map((r, i) => `${i}. "${r.title}" by ${r.channel}`).join('\n')}

Return ONLY the index number (0-${results.length - 1}), nothing else.`;

  try {
    const result = await gen.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/(\d+)/);
    const idx = match ? parseInt(match[1]) : 0;
    return results[Math.min(idx, results.length - 1)];
  } catch {
    return results[0];
  }
}

export async function generateSceneQueries(script, segments) {
  const gen = getModel();
  const prompt = `Given this YouTube Shorts script broken into timed segments, generate a specific YouTube search query for EACH segment to find matching background footage.

Full script: """${script}"""

Segments:
${segments.map((s, i) => `[${i}] ${s.start}s-${s.end}s: "${s.text}"`).join('\n')}

For each segment, generate a 3-6 word YouTube search query that describes what VISUAL should appear during that segment. The query should be specific footage terms (not generic "video" or "footage").

Return ONLY valid JSON array, no markdown:
[
  {"index":0,"query":"ocean wave crashing slow motion"},
  {"index":1,"query":"underwater coral reef fish"},
  ...
]`;

  const result = await gen.generateContent(prompt);
  let text = result.response.text().trim();
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Failed to parse scene queries');
  const queries = JSON.parse(jsonMatch[0]);
  return queries.map(q => q.query).filter(Boolean);
}

export async function generateSceneSegments(script) {
  const gen = getModel();
  const prompt = `Given this YouTube Shorts script, divide it into logical visual segments.

Each segment should represent a distinct visual scene or concept that would work well as a separate background video clip. The AI should decide how many segments make sense based on the content — do NOT force one segment per sentence. Group related sentences together if they share a visual theme.

Script: """${script}"""

For each segment, provide:
- start_word: the 0-based index of the first word in this segment
- end_word: the 0-based index of the last word in this segment (exclusive, so next segment starts here)
- query: a specific 3-8 word YouTube search query to find matching background footage for this segment

Return ONLY valid JSON array, no markdown:
[
  {"start_word":0,"end_word":15,"query":"ocean waves crashing slow motion"},
  {"start_word":15,"end_word":32,"query":"underwater coral reef tropical fish"}
]`;

  const result = await gen.generateContent(prompt);
  let text = result.response.text().trim();
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Failed to parse scene segments from AI response');
  const segments = JSON.parse(jsonMatch[0]);
  return segments.map(s => ({
    start_word: s.start_word,
    end_word: s.end_word,
    query: s.query
  })).filter(s => s.query && s.end_word > s.start_word);
}