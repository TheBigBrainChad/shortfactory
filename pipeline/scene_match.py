#!/usr/bin/env python3
"""ShortFactory — Smart Scene Matching
Downloads background clips matching AI-provided script segments, scans each
downloaded video with AI vision every 5 seconds to find the best matching
segment, trims it, and concatenates into a single seamless background video."""

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
    env['YTDLP_JS_RUNTIMES'] = 'node'
    env['YTDLP_REMOTE_COMPONENTS'] = 'ejs:github'
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
        '--js-runtimes', 'node',
        '--remote-components', 'ejs:github',
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


def extract_montage(video_path, output_path, interval=5, max_frames=16):
    """Create a JPEG montage of frames from the video, one every `interval` seconds."""
    ffmpeg = find_ffmpeg()
    duration = get_duration(video_path)

    if duration <= 0:
        return False

    # For long videos, adjust interval to cap at max_frames
    actual_interval = interval
    if duration / interval > max_frames:
        actual_interval = duration / max_frames

    # Calculate grid size
    frame_count = min(int(duration / actual_interval) + 1, max_frames)
    cols = min(4, frame_count)
    rows = (frame_count + cols - 1) // cols

    vf = f'fps=1/{actual_interval},scale=320:-1,tile={cols}x{rows}:padding=4:color=black'

    cmd = [
        ffmpeg, '-y', '-i', video_path,
        '-vf', vf,
        '-q:v', '3',
        '-frames:v', '1',
        output_path
    ]

    try:
        result = subprocess.run(cmd, env=get_render_env(), capture_output=True, text=True, timeout=30)
        return result.returncode == 0 and os.path.exists(output_path)
    except Exception as e:
        print(f'   Montage extraction error: {e}', flush=True)
        return False


def get_frame_count(video_path, interval=5, max_frames=16):
    duration = get_duration(video_path)
    if duration <= 0:
        return 0
    actual_interval = interval
    if duration / interval > max_frames:
        actual_interval = duration / max_frames
    return min(int(duration / actual_interval) + 1, max_frames)


def get_scan_interval(video_path, interval=5, max_frames=16):
    """Return the actual interval used for scanning based on video length."""
    duration = get_duration(video_path)
    if duration <= 0:
        return interval
    if duration / interval > max_frames:
        return duration / max_frames
    return interval


def score_video_segment(montage_path, query, frame_count, gemini_key):
    """Call Node.js AI scorer to find best frame in montage."""
    node = shutil.which('node') or 'node'
    score_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'score_frames.mjs')

    if not os.path.isfile(score_script):
        raise FileNotFoundError(f'Score script not found: {score_script}')

    cmd = [
        node, score_script,
        '--montage', montage_path,
        '--query', query,
        '--count', str(frame_count)
    ]

    env = dict(os.environ)
    env['GEMINI_API_KEY'] = gemini_key

    result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f'Scorer failed: {result.stderr[:300]}')

    return json.loads(result.stdout)


def trim_clip(input_path, output_path, duration, start_offset=0):
    """Trim a clip to exact duration from start_offset."""
    ffmpeg = find_ffmpeg()
    total_duration = get_duration(input_path)

    if total_duration <= 0:
        return False

    cmd = [
        ffmpeg, '-y', '-ss', str(start_offset), '-t', str(duration),
        '-i', input_path,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
        '-r', '30', '-pix_fmt', 'yuv420p',
        '-an',
        output_path
    ]

    try:
        result = subprocess.run(cmd, env=get_render_env(), capture_output=True, text=True, timeout=60)
        return result.returncode == 0 and os.path.exists(output_path)
    except Exception as e:
        print(f'   Trim error: {e}', flush=True)
        return False


def concatenate_clips(clip_paths, output_path):
    """Concatenate clips using FFmpeg concat demuxer."""
    ffmpeg = find_ffmpeg()
    if len(clip_paths) == 0:
        return False
    if len(clip_paths) == 1:
        shutil.copy2(clip_paths[0], output_path)
        return True

    tmp_dir = os.path.dirname(output_path)
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


def process_segment(segment, brave_key, gemini_key, tmp_dir, index):
    """Process one segment: search, download, AI-scan, trim best part."""
    duration = segment['end'] - segment['start']
    if duration < 0.3:
        print(f'   Segment {index} too short ({duration:.1f}s), skipping', flush=True)
        return None

    query = segment['query']
    print(f'[{index+1}] "{query}" ({duration:.1f}s)', flush=True)

    results = search_youtube(query, brave_key)
    if not results:
        print(f'   No results for "{query}", trying broader search...', flush=True)
        results = search_youtube(query + ' footage', brave_key)

    if not results:
        print(f'   No clips found for segment {index}', flush=True)
        return None

    for result in results:
        video_id = result['videoId']
        raw_path = os.path.join(tmp_dir, f'seg_{index:03d}_{video_id}.mp4')
        trimmed_path = os.path.join(tmp_dir, f'seg_{index:03d}_trimmed.mp4')
        montage_path = os.path.join(tmp_dir, f'seg_{index:03d}_montage.jpg')

        if not download_clip(video_id, raw_path):
            print(f'   Download failed for {video_id}, trying next result', flush=True)
            continue

        video_duration = get_duration(raw_path)
        if video_duration < duration:
            print(f'   Video too short ({video_duration:.1f}s < {duration:.1f}s), trying next result', flush=True)
            continue

        # AI frame scanning
        best_time = None
        if gemini_key and extract_montage(raw_path, montage_path):
            frame_count = get_frame_count(raw_path)
            scan_interval = get_scan_interval(raw_path)
            try:
                score_result = score_video_segment(montage_path, query, frame_count, gemini_key)
                best_index = score_result.get('best_index', 0)
                confidence = score_result.get('confidence', 0)
                print(f'   AI pick: frame {best_index}/{frame_count} (confidence: {confidence})', flush=True)
                best_time = best_index * scan_interval
            except Exception as e:
                print(f'   AI scoring failed: {e}, will use random trim', flush=True)

        if best_time is None:
            # Fallback: random trim
            best_time = random.uniform(0, max(0, video_duration - duration))
            print(f'   Random trim at {best_time:.1f}s', flush=True)

        # Ensure the clip fits within video bounds
        if best_time + duration > video_duration:
            best_time = max(0, video_duration - duration)
            print(f'   Adjusted to fit: {best_time:.1f}s', flush=True)

        if trim_clip(raw_path, trimmed_path, duration, start_offset=best_time):
            print(f'   Trimmed {duration:.1f}s from {best_time:.1f}s', flush=True)
            return trimmed_path
        else:
            print(f'   Trim failed for {video_id}, trying next result', flush=True)

    return None


def main():
    parser = argparse.ArgumentParser(description='Smart scene matching with AI frame scanning')
    parser.add_argument('--segments', required=True, help='Segments JSON file with start/end/query')
    parser.add_argument('--output', required=True, help='Output concatenated video')
    parser.add_argument('--brave-key', required=True, help='Brave Search API key')
    parser.add_argument('--gemini-key', default='', help='Gemini API key for AI frame scoring (optional)')
    args = parser.parse_args()

    with open(args.segments) as f:
        segments = json.load(f)

    print(f'🎬 Scene matching: {len(segments)} AI-generated segments...', flush=True)

    tmp_dir = tempfile.mkdtemp(prefix='sf-scenes-')
    clip_paths = []

    for i, segment in enumerate(segments):
        trimmed = process_segment(segment, args.brave_key, args.gemini_key or None, tmp_dir, i)
        if trimmed:
            clip_paths.append(trimmed)

    if not clip_paths:
        print('❌ No clips could be downloaded for any segment.', flush=True)
        shutil.rmtree(tmp_dir, ignore_errors=True)
        sys.exit(1)

    print(f'🎞 Concatenating {len(clip_paths)} clips...', flush=True)
    if concatenate_clips(clip_paths, args.output):
        print(f'✅ Scene-matched background: {args.output}', flush=True)
    else:
        print('❌ Concatenation failed', flush=True)
        sys.exit(1)

    # Cleanup raw downloads and montages, keep trimmed
    for f in os.listdir(tmp_dir):
        if 'trimmed' not in f:
            try:
                os.remove(os.path.join(tmp_dir, f))
            except Exception:
                pass


if __name__ == '__main__':
    main()
