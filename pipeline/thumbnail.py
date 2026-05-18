#!/usr/bin/env python3
"""ShortFactory — Thumbnail Generator
Primary: AI generation via Gemini image model
Fallback: Extract frame + overlay title text via Pillow"""

import argparse
import os
import subprocess
import sys
import shutil


def find_ffmpeg():
    for candidate in [shutil.which('ffmpeg'), '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg',
                      '/usr/lib/jellyfin-ffmpeg/ffmpeg', os.path.expanduser('~/.local/bin/ffmpeg')]:
        if candidate and os.path.isfile(candidate):
            return candidate
    return 'ffmpeg'


def generate_thumbnail_ai(title, topic, output, api_key=None, model='gemini-2.0-flash-exp'):
    try:
        import google.generativeai as genai

        if api_key:
            genai.configure(api_key=api_key)

        prompt = f"""Generate a YouTube Shorts thumbnail image (vertical 1080x1920).

Video title: "{title}"
Topic: "{topic}"

Requirements:
- Bold, eye-catching design with vibrant, saturated colors
- Include a text overlay with the key catchphrase (short version of the title)
- High contrast, dramatic lighting
- Modern, trendy aesthetic that stops the scroll
- NO watermarks, logos, or watermarks
- Vertical 9:16 aspect ratio
- The background should be dynamic and visually interesting

Generate just the image."""

        client = genai.GenerativeModel(model)
        response = client.generate_content(prompt)

        for part in response.candidates[0].content.parts:
            if hasattr(part, 'inline_data') and part.inline_data:
                with open(output, 'wb') as f:
                    f.write(part.inline_data.data)
                print(f'✅ AI thumbnail generated: {output}', flush=True)
                return True

        print('⚠️ No image data in AI response, using fallback', flush=True)
        return False
    except Exception as e:
        print(f'⚠️ AI thumbnail failed: {e}, using fallback', flush=True)
        return False


def generate_thumbnail_fallback(video_path, title, output):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print('⚠️ Pillow not available, using basic fallback', flush=True)
        return generate_thumbnail_basic(title, output)

    ffmpeg = find_ffmpeg()
    frame_path = output + '.frame.png'
    if video_path and os.path.exists(video_path):
        cmd = [ffmpeg, '-y', '-i', video_path, '-ss', '3', '-vframes', '1', '-q:v', '2', frame_path]
        subprocess.run(cmd, capture_output=True)

    if os.path.exists(frame_path):
        img = Image.open(frame_path)
        img = img.resize((1080, 1920), Image.LANCZOS)
    else:
        img = Image.new('RGB', (1080, 1920), color='#0a0a0a')

    overlay = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for y in range(0, 1920, 2):
        alpha = int(160 * (1 - abs(y - 960) / 960))
        draw.rectangle([(0, y), (1080, y + 1)], fill=(0, 0, 0, alpha))

    img = img.convert('RGBA')
    img = Image.alpha_composite(img, overlay)

    draw = ImageDraw.Draw(img)

    try:
        font_large = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 72)
        font_small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 44)
    except Exception:
        try:
            font_large = ImageFont.truetype('DejaVuSans-Bold.ttf', 72)
            font_small = ImageFont.truetype('DejaVuSans-Bold.ttf', 44)
        except Exception:
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()

    words = title.split()
    mid = len(words) // 2 if len(words) > 3 else 0
    line1 = ' '.join(words[:mid]) if mid else ' '.join(words)
    line2 = ' '.join(words[mid:]) if mid else ''

    y_start = 700 if line2 else 800
    for line, font, color in [(line1, font_large, '#FF6B00'), (line2, font_small, '#FFFFFF')]:
        if line:
            bbox = draw.textbbox((0, 0), line, font=font)
            tw = bbox[2] - bbox[0]
            x = (1080 - tw) // 2
            for offset in [(2, 2), (-2, 2), (2, -2), (-2, -2)]:
                draw.text((x + offset[0], y_start + offset[1]), line, font=font, fill='#000000')
            draw.text((x, y_start), line, font=font, fill=color)
            y_start += 100

    img = img.convert('RGB')
    img.save(output, 'PNG')
    print(f'✅ Fallback thumbnail saved: {output}', flush=True)

    if os.path.exists(frame_path):
        os.remove(frame_path)

    return True


def generate_thumbnail_basic(title, output):
    img = Image.new('RGB', (1080, 1920), color='#0d0f12')
    draw = ImageDraw.Draw(img)
    draw.rectangle([(0, 800), (1080, 1200)], fill='#141720')
    draw.text((540, 960), title[:40], fill='#00f0ff', anchor='mm')
    img.save(output, 'PNG')
    print(f'✅ Basic thumbnail saved: {output}', flush=True)
    return True


def main():
    parser = argparse.ArgumentParser(description='Generate video thumbnail')
    parser.add_argument('--video', default='', help='Video file path (for fallback)')
    parser.add_argument('--title', required=True, help='Video title')
    parser.add_argument('--topic', default='', help='Video topic')
    parser.add_argument('--output', required=True, help='Output image path')
    parser.add_argument('--api-key', default='', help='Gemini API key')
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    api_key = args.api_key or os.environ.get('GEMINI_API_KEY', '')
    ai_model = os.environ.get('AI_IMAGE_MODEL', 'gemini-2.0-flash-exp')

    if api_key:
        success = generate_thumbnail_ai(args.title, args.topic or args.title, args.output, api_key, ai_model)

    if not api_key or not success:
        generate_thumbnail_fallback(args.video, args.title, args.output)


if __name__ == '__main__':
    main()