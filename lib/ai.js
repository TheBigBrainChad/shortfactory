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
  const imageModel = process.env.AI_IMAGE_MODEL || getSetting('ai_image_model') || 'gemini-2.0-flash-exp';
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