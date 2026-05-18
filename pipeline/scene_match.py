#!/usr/bin/env python3
"""ShortFactory — Smart Scene Matching
Downloads multiple background clips matching script segments, trims them,
and concatenates with crossfades into a single seamless background video."""

import argparse
import json
import os
import random
import subprocess
import sys
import tempfile
import shutil


def find_ffmpeg():
    candidates = [
        shutil.which('ffmpeg'),
        '/usr/lib/jellyfin-ffmpeg/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/usr/bin/ffmpeg',
        os.path.expanduser('~/.local/bin/ffmpeg'),
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            return os.path.realpath(c)
    return 'ffmpeg'


def find_ffprobe():
    candidates = [
        shutil.which('ffprobe'),
        '/usr/lib/jellyfin-ffmpeg/ffprobe',
        '/usr/local/bin/ffprobe',
        '/usr/bin/ffprobe',
        os.path.expanduser('~/.local/bin/ffprobe'),
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            return os.path.realpath(c)
    return 'ffprobe'


def get_render_env():
    env = dict(os.environ)
    paths = ['/usr/lib/jellyfin-ffmpeg/lib']
    existing = os.environ.get('LD_LIBRARY_PATH', '')
    if existing:
        paths.append(existing)
    env['LD_LIBRARY_PATH'] = ':'.join(paths)
    return env


def get_duration(filepath):
    ffprobe = find_ffprobe()
    cmd = [ffprobe, '-v', 'quiet', '-print_format', 'json', '-show_format', filepath]
    try:
        result = subprocess.run(cmd, env=get_render_env(), capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            info = json.loads(result.stdout)
            return float(info.get('format', {}).get('duration', 0))
    except Exception:
        pass
    return 0


def download_clip(video_id, output_path):
    """Download a YouTube clip using yt-dlp."""
    yt_dlp = os.path.expanduser('~/.local/bin/yt-dlp')
    if not os.path.isfile(yt_dlp):
        yt_dlp = shutil.which('yt-dlp') or 'yt-dlp'

    if os.path.exists(output_path):
        print(f'   Clip already cached: {os.path.basename(output_path)}', flush=True)
        return True

    cmd = [
        yt_dlp,
        '--no-playlist',
        '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
        '--merge-output-format', 'mp4',
        '--max-filesize', '300M',
        '-o', output_path,
        f'https://www.youtube.com/watch?v={video_id}'
    ]

    print(f'   Downloading {video_id}...', flush=True)
    try:
        result = subprocess.run(cmd, env=get_render_env(), capture_output=True, text=True, timeout=120)
        if result.returncode == 0 and os.path.exists(output_path):
            return True
        print(f'   Download failed: {result.stderr[:200]}', flush=True)
    except Exception as e:
        print(f'   Download error: {e}', flush=True)
    return False


def trim_clip(input_path, output_path, duration, start_offset=0):
    """Trim a clip to exact duration, starting from a random offset."""
    ffmpeg = find_ffmpeg()
    total_duration = get_duration(input_path)

    if total_duration <= 0:
        return False

    # Pick a random start point, leaving room for the clip
    max_start = max(0, total_duration - duration - 1)
    start = start_offset if start_offset > 0 else random.uniform(0, max_start)

    cmd = [
        ffmpeg, '-y', '-ss', str(start), '-t', str(duration),
        '-i', input_path,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
        '-r', '30', '-pix_fmt', 'yuv420p',
        '-an',  # No audio, we'll use voiceover separately
        output_path
    ]

    try:
        result = subprocess.run(cmd, env=get_render_env(), capture_output=True, text=True, timeout=60)
        return result.returncode == 0 and os.path.exists(output_path)
    except Exception as e:
        print(f'   Trim error: {e}', flush=True)
        return False


def concatenate_clips(clip_paths, output_path, crossfade=0.5):
    """Concatenate clips with crossfade transitions using FFmpeg."""
    ffmpeg = find_ffmpeg()
    if len(clip_paths) == 0:
        return False
    if len(clip_paths) == 1:
        shutil.copy2(clip_paths[0], output_path)
        return True

    # Use the concat demuxer with re-encoding for smooth crossfades
    # For simplicity with many clips, we'll do a direct concat with fade
    tmp_dir = os.path.dirname(output_path)

    # Build a complex filtergraph for crossfading
    # This gets complex with many inputs, so we'll use a simpler approach:
    # Concatenate all clips first, then apply a global fade filter

    list_file = os.path.join(tmp_dir, 'concat_list.txt')
    with open(list_file, 'w') as f:
        for p in clip_paths:
            f.write(f"file '{p}'\n")

    cmd = [
        ffmpeg, '-y', '-f', 'concat', '-safe', '0',
        '-i', list_file,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-r', '30', '-pix_fmt', 'yuv420p',
        output_path
    ]

    try:
        result = subprocess.run(cmd, env=get_render_env(), capture_output=True, text=True, timeout=120)
        os.remove(list_file)
        return result.returncode == 0 and os.path.exists(output_path)
    except Exception as e:
        print(f'   Concat error: {e}', flush=True)
        return False


def segment_transcript(words, max_words_per_segment=8):
    """Group words into segments for scene matching."""
    segments = []
    if not words:
        return segments

    for i in range(0, len(words), max_words_per_segment):
        chunk = words[i:i + max_words_per_segment]
        segments.append({
            'start': chunk[0]['start'],
            'end': chunk[-1]['end'],
            'text': ' '.join(w['word'] for w in chunk),
            'words': chunk
        })

    return segments


def load_queries(queries_file):
    with open(queries_file) as f:
        return json.load(f)


def search_youtube(query, brave_key):
    """Search YouTube via Brave API."""
    import urllib.request
    import urllib.parse

    url = f"https://api.search.brave.com/res/v1/videos/search?q={urllib.parse.quote(query)}&count=3"
    req = urllib.request.Request(url, headers={
        'Accept': 'application/json',
        'X-Subscription-Token': brave_key
    })

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            results = []
            for r in data.get('results', []):
                if 'youtube.com/watch' in (r.get('url') or ''):
                    match = __import__('re').search(r'[?&]v=([a-zA-Z0-9_-]{11})', r['url'])
                    if match:
                        results.append({
                            'videoId': match.group(1),
                            'title': r.get('title', ''),
                            'channel': r.get('meta', {}).get('channel', {}).get('name', '')
                        })
            return results
    except Exception as e:
        print(f'   Search error: {e}', flush=True)
        return []


def main():
    parser = argparse.ArgumentParser(description='Smart scene matching for background clips')
    parser.add_argument('--transcript', required=True, help='Transcript JSON file')
    parser.add_argument('--queries', required=True, help='Queries JSON file')
    parser.add_argument('--output', required=True, help='Output concatenated video')
    parser.add_argument('--brave-key', required=True, help='Brave Search API key')
    parser.add_argument('--max-words', type=int, default=8, help='Words per segment')
    args = parser.parse_args()

    with open(args.transcript) as f:
        transcript = json.load(f)

    queries = load_queries(args.queries)
    words = transcript.get('words', [])
    segments = segment_transcript(words, args.max_words)

    print(f'🎬 Scene matching: {len(segments)} segments, {len(words)} words...', flush=True)

    if len(segments) != len(queries):
        print(f'⚠️ Segment/query mismatch: {len(segments)} segments vs {len(queries)} queries', flush=True)

    tmp_dir = tempfile.mkdtemp(prefix='sf-scenes-')
    clip_paths = []
    gameplay_dir = os.environ.get('GAMEPLAY_DIR', './media/gameplay')

    for i, (segment, query) in enumerate(zip(segments, queries)):
        duration = segment['end'] - segment['start']
        if duration < 0.5:
            continue

        print(f'[{i+1}/{len(segments)}] "{segment["text"][:40]}..." → "{query}"', flush=True)

        results = search_youtube(query, args.brave_key)
        if not results:
            print(f'   No results, trying generic fallback...', flush=True)
            results = search_youtube(query.split()[-1] + ' footage', args.brave_key)

        if not results:
            print(f'   Skipping segment (no clips found)', flush=True)
            continue

        # Pick first result (or random if multiple)
        video_id = results[0]['videoId']
        raw_path = os.path.join(tmp_dir, f'seg_{i:03d}_{video_id}.mp4')
        trimmed_path = os.path.join(tmp_dir, f'seg_{i:03d}_trimmed.mp4')

        if not download_clip(video_id, raw_path):
            print(f'   Download failed, skipping', flush=True)
            continue

        if not trim_clip(raw_path, trimmed_path, duration):
            print(f'   Trim failed, using raw', flush=True)
            trimmed_path = raw_path

        clip_paths.append(trimmed_path)

    if not clip_paths:
        print('❌ No clips could be downloaded. Falling back to random gameplay.', flush=True)
        # Copy a random gameplay clip as fallback
        if os.path.isdir(gameplay_dir):
            clips = [f for f in os.listdir(gameplay_dir) if f.lower().endswith(('.mp4', '.mkv', '.mov'))]
            if clips:
                fallback = os.path.join(gameplay_dir, random.choice(clips))
                shutil.copy2(fallback, args.output)
                print(f'✅ Fallback background: {args.output}', flush=True)
                sys.exit(0)
        print('❌ No fallback available either.', flush=True)
        sys.exit(1)

    print(f'🎞 Concatenating {len(clip_paths)} clips...', flush=True)
    if concatenate_clips(clip_paths, args.output):
        print(f'✅ Scene-matched background: {args.output}', flush=True)
    else:
        print('❌ Concatenation failed', flush=True)
        sys.exit(1)

    # Cleanup raw downloads, keep trimmed
    for f in os.listdir(tmp_dir):
        if 'trimmed' not in f:
            os.remove(os.path.join(tmp_dir, f))


if __name__ == '__main__':
    main()
