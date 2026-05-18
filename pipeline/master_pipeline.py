#!/usr/bin/env python3
"""
ShortFactory — Master Pipeline
Orchestrates: TTS → Transcribe → Subtitles → Render → Thumbnail
Prints stage markers for Node.js progress tracking.
Final line: __PIPELINE_RESULT__:{json}
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path


def log(msg):
    ts = time.strftime('%H:%M:%S')
    print(f"[{ts}] {msg}", flush=True)


def run_step(script_name, args, env=None):
    script_path = Path(__file__).parent / script_name
    cmd = [sys.executable, str(script_path)] + args
    merged_env = {**os.environ, **(env or {})}

    proc = subprocess.Popen(
        cmd,
        env=merged_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    for line in proc.stdout:
        line = line.strip()
        if line:
            log(line)

    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"Step {script_name} failed with exit code {proc.returncode}")


def main():
    parser = argparse.ArgumentParser(description='ShortFactory Pipeline')
    parser.add_argument('--script', required=True, help='Script text')
    parser.add_argument('--title', required=True, help='Video title')
    parser.add_argument('--description', default='', help='Video description')
    parser.add_argument('--tags', default='', help='Comma-separated tags')
    parser.add_argument('--gameplay-dir', required=True, help='Directory with gameplay clips')
    parser.add_argument('--output-dir', required=True, help='Output directory')
    parser.add_argument('--openai-key', default='', help='OpenAI API key')
    parser.add_argument('--voice', default='en-US-GuyNeural', help='TTS voice')
    parser.add_argument('--dry-run', action='store_true', help='Skip actual rendering')
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    audio_path = os.path.join(args.output_dir, 'voiceover.mp3')
    transcript_path = os.path.join(args.output_dir, 'transcript.json')
    subtitle_path = os.path.join(args.output_dir, 'subtitles.ass')
    video_path = os.path.join(args.output_dir, 'output.mp4')

    env = {}
    if args.openai_key:
        env['OPENAI_API_KEY'] = args.openai_key

    try:
        log('🎤 Generating voiceover...')
        if not args.dry_run:
            run_step('tts.py', [
                '--text', args.script,
                '--voice', args.voice,
                '--output', audio_path,
                '--rate', '+5%'
            ])

        log('📝 Transcribing...')
        if not args.dry_run:
            run_step('transcribe.py', [
                '--audio', audio_path,
                '--output', transcript_path
            ], env=env)

        log('✨ Creating karaoke subtitles...')
        if not args.dry_run:
            run_step('subtitles.py', [
                '--transcript', transcript_path,
                '--output', subtitle_path
            ])

        log('🎬 Rendering video...')
        if not args.dry_run:
            run_step('render.py', [
                '--background', args.gameplay_dir,
                '--audio', audio_path,
                '--subtitles', subtitle_path,
                '--output', video_path
            ])

        log('🖼 Generating thumbnail...')
        if not args.dry_run:
            thumbnail_path = os.path.join(args.output_dir, 'thumbnail.png')
            run_step('thumbnail.py', [
                '--video', video_path,
                '--title', args.title,
                '--output', thumbnail_path
            ], env=env)

        duration = 0
        file_size = 0
        if os.path.exists(video_path):
            file_size = round(os.path.getsize(video_path) / (1024 * 1024), 1)

        if os.path.exists(transcript_path):
            try:
                with open(transcript_path) as f:
                    transcript = json.load(f)
                    duration = round(transcript.get('duration', 0), 1)
            except Exception:
                pass

        result = {
            'status': 'success',
            'title': args.title,
            'duration': duration,
            'size_mb': file_size,
            'video_path': video_path,
            'audio_path': audio_path,
            'subtitle_path': subtitle_path
        }

        log('✅ Pipeline completed successfully!')
        print(f'__PIPELINE_RESULT__:{json.dumps(result)}', flush=True)
        sys.exit(0)

    except Exception as e:
        log(f'❌ Pipeline failed: {e}')
        result = {
            'status': 'failed',
            'error': str(e),
            'title': args.title
        }
        print(f'__PIPELINE_RESULT__:{json.dumps(result)}', flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()