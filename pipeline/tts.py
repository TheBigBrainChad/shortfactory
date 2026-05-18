#!/usr/bin/env python3
"""ShortFactory — TTS Voiceover Generator
Uses Microsoft Edge TTS (free, no API key needed)."""

import argparse
import asyncio
import os
import edge_tts


async def generate_tts(text, voice, output, rate):
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(output)


def main():
    parser = argparse.ArgumentParser(description='Generate TTS voiceover')
    parser.add_argument('--text', default='', help='Script text (inline)')
    parser.add_argument('--script-file', default='', help='Path to script text file')
    parser.add_argument('--voice', default='en-US-GuyNeural', help='Voice name')
    parser.add_argument('--output', required=True, help='Output MP3 path')
    parser.add_argument('--rate', default='+5%', help='Speech rate')
    args = parser.parse_args()

    if args.script_file and os.path.isfile(args.script_file):
        with open(args.script_file, 'r', encoding='utf-8') as f:
            text = f.read().strip()
    elif args.text:
        text = args.text
    else:
        print('ERROR: No text provided. Use --text or --script-file', flush=True)
        exit(1)

    if not text:
        print('ERROR: Script text is empty', flush=True)
        exit(1)

    print(f'🎤 Generating voiceover with {args.voice} ({len(text.split())} words)...', flush=True)
    asyncio.run(generate_tts(text, args.voice, args.output, args.rate))

    size = os.path.getsize(args.output)
    print(f'✅ Voiceover saved: {args.output} ({size / 1024:.1f} KB)', flush=True)


if __name__ == '__main__':
    main()