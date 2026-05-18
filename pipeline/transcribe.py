#!/usr/bin/env python3
"""ShortFactory — Transcription with Word-Level Timestamps
Uses OpenAI Whisper API for transcription.
Falls back to simple word estimation if API is unavailable."""

import argparse
import json
import os
import sys
import math

def main():
    parser = argparse.ArgumentParser(description='Transcribe audio with word timestamps')
    parser.add_argument('--audio', required=True, help='Input audio file')
    parser.add_argument('--output', required=True, help='Output JSON path')
    args = parser.parse_args()

    if not os.path.exists(args.audio):
        print(f'ERROR: Audio file not found: {args.audio}', flush=True)
        sys.exit(1)

    api_key = os.environ.get('OPENAI_API_KEY', '')
    if not api_key:
        print('⚠️ No OPENAI_API_KEY set, using fallback word estimation', flush=True)
        fallback_transcribe(args.audio, args.output)
        return

    print(f'📝 Transcribing {os.path.basename(args.audio)}...', flush=True)

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        with open(args.audio, 'rb') as audio_file:
            response = client.audio.transcriptions.create(
                model='whisper-1',
                file=audio_file,
                response_format='verbose_json',
                timestamp_granularities=['word']
            )
    except ImportError:
        print('⚠️ openai package not installed, using fallback', flush=True)
        fallback_transcribe(args.audio, args.output)
        return
    except Exception as e:
        error_msg = str(e)
        print(f'⚠️ Whisper API failed: {error_msg}', flush=True)
        print('⚠️ Falling back to word-level estimation', flush=True)
        fallback_transcribe(args.audio, args.output)
        return

    words = []
    if hasattr(response, 'words') and response.words:
        for w in response.words:
            words.append({
                'word': w.word,
                'start': round(w.start, 3),
                'end': round(w.end, 3)
            })

    result = {
        'text': response.text if hasattr(response, 'text') else '',
        'words': words,
        'duration': round(response.duration, 2) if hasattr(response, 'duration') else 0,
        'language': getattr(response, 'language', 'en')
    }

    save_result(args.output, result)
    print(f'✅ Transcription: {len(words)} words, {result["duration"]}s', flush=True)


def fallback_transcribe(audio_path, output_path):
    """Estimate word timestamps from audio duration when Whisper is unavailable."""
    print('📝 Estimating word timestamps from script...', flush=True)

    duration = get_audio_duration(audio_path)

    # Read the script file if available (same directory, script.txt)
    script_path = os.path.join(os.path.dirname(audio_path), 'script.txt')
    text = ''
    if os.path.exists(script_path):
        with open(script_path, 'r', encoding='utf-8') as f:
            text = f.read().strip()
    else:
        text = 'Short factory produced content.'

    words_list = text.split()
    if not words_list:
        text = 'Short factory produced content.'
        words_list = text.split()

    word_duration = duration / len(words_list) if words_list else 0.5

    words = []
    for i, word in enumerate(words_list):
        start = round(i * word_duration, 3)
        end = round((i + 1) * word_duration, 3)
        # Clean punctuation from the word for display
        clean_word = word.strip('.,!?;:')
        words.append({
            'word': clean_word,
            'start': start,
            'end': end
        })

    result = {
        'text': text,
        'words': words,
        'duration': round(duration, 2),
        'language': 'en'
    }

    save_result(output_path, result)
    print(f'✅ Estimated: {len(words)} words, {result["duration"]}s (fallback mode)', flush=True)


def get_audio_duration(audio_path):
    """Get audio duration using ffprobe or file size estimation."""
    try:
        import subprocess
        probe = find_ffprobe()
        result = subprocess.run(
            [probe, '-v', 'quiet', '-print_format', 'json', '-show_format', audio_path],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            info = json.loads(result.stdout)
            dur = float(info.get('format', {}).get('duration', 0))
            if dur > 0:
                return dur
    except Exception:
        pass

    # Fallback: estimate from file size (~6KB per second for 128kbps MP3)
    try:
        size = os.path.getsize(audio_path)
        return max(size / (6 * 1024), 10)
    except Exception:
        return 30  # default 30 seconds


def find_ffmpeg():
    import shutil
    for candidate in [shutil.which('ffmpeg'), '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg',
                      '/usr/lib/jellyfin-ffmpeg/ffmpeg', os.path.expanduser('~/.local/bin/ffmpeg')]:
        if candidate and os.path.isfile(candidate):
            return candidate
    return 'ffmpeg'


def find_ffprobe():
    import shutil
    for candidate in [shutil.which('ffprobe'), '/usr/local/bin/ffprobe', '/usr/bin/ffprobe',
                      '/usr/lib/jellyfin-ffmpeg/ffprobe', os.path.expanduser('~/.local/bin/ffprobe')]:
        if candidate and os.path.isfile(candidate):
            return candidate
    return 'ffprobe'


def save_result(output_path, result):
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2)


if __name__ == '__main__':
    main()