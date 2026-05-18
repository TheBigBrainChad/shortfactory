#!/usr/bin/env python3
"""ShortFactory — Video Renderer
Composites gameplay background + subtitles + voiceover audio into a vertical Short."""

import argparse
import json
import os
import random
import shutil
import subprocess
import sys


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


def get_ld_library_path():
    paths = ['/usr/lib/jellyfin-ffmpeg/lib']
    existing = os.environ.get('LD_LIBRARY_PATH', '')
    if existing:
        paths.append(existing)
    return ':'.join(paths)


def get_render_env():
    env = dict(os.environ)
    env['LD_LIBRARY_PATH'] = get_ld_library_path()
    return env


def resolve_background(background_arg):
    if os.path.isfile(background_arg):
        return background_arg
    clips = []
    if not os.path.isdir(background_arg):
        return None
    for f in os.listdir(background_arg):
        if f.lower().endswith(('.mp4', '.mkv', '.mov', '.avi', '.webm')):
            clips.append(os.path.join(background_arg, f))
    if not clips:
        return None
    return random.choice(clips)


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


def render_video(background, audio, subtitles, output, max_duration=59):
    ffmpeg = find_ffmpeg()
    audio_duration = get_duration(audio)
    target_duration = min(audio_duration, max_duration) if audio_duration > 0 else max_duration

    subtitle_escaped = subtitles.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace('[', '\\[').replace(']', '\\]')

    cmd = [
        ffmpeg, '-y',
        '-stream_loop', '-1',
        '-i', background,
        '-i', audio,
        '-map', '0:v',
        '-map', '1:a',
        '-vf', f'subtitles={subtitle_escaped},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '18',
        '-r', '30',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-t', str(target_duration),
        '-movflags', '+faststart',
        output
    ]

    print(f'🎬 Rendering video with {os.path.basename(ffmpeg)}...', flush=True)
    print(f'   Target duration: {target_duration:.1f}s', flush=True)
    env = get_render_env()
    proc = subprocess.Popen(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in proc.stdout:
        line = line.strip()
        if line:
            print(line, flush=True)
    proc.wait()

    if proc.returncode != 0:
        print(f'❌ FFmpeg failed with code {proc.returncode}', flush=True)
        raise RuntimeError(f'FFmpeg failed with code {proc.returncode}')

    return output


def check_and_reencode(output, max_size_mb=80):
    if not os.path.exists(output):
        return
    file_size = os.path.getsize(output) / (1024 * 1024)
    print(f'📁 Output size: {file_size:.1f} MB', flush=True)

    if file_size > max_size_mb:
        print(f'⚠️ File too large ({file_size:.1f} MB), re-encoding at CRF 28...', flush=True)
        ffmpeg = find_ffmpeg()
        temp = output + '.tmp.mp4'
        cmd = [
            ffmpeg, '-y', '-i', output,
            '-c:v', 'libx264', '-crf', '28',
            '-c:a', 'aac', '-b:a', '192k',
            '-movflags', '+faststart',
            temp
        ]
        subprocess.run(cmd, env=get_render_env(), check=True)
        os.replace(temp, output)
        new_size = os.path.getsize(output) / (1024 * 1024)
        print(f'✅ Re-encoded to {new_size:.1f} MB', flush=True)


def main():
    parser = argparse.ArgumentParser(description='Render Short video')
    parser.add_argument('--background', required=True, help='Video file or directory with gameplay clips')
    parser.add_argument('--audio', required=True, help='Voiceover audio MP3')
    parser.add_argument('--subtitles', required=True, help='ASS subtitle file')
    parser.add_argument('--output', required=True, help='Output MP4 path')
    parser.add_argument('--max-duration', type=int, default=59, help='Max duration in seconds')
    args = parser.parse_args()

    background = resolve_background(args.background)
    if not background:
        print('❌ No gameplay clips found!', flush=True)
        sys.exit(1)

    print(f'🎮 Using background: {os.path.basename(background)}', flush=True)

    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else '.', exist_ok=True)
    render_video(background, args.audio, args.subtitles, args.output, args.max_duration)
    check_and_reencode(args.output)

    duration = get_duration(args.output)
    print(f'✅ Video rendered: {args.output} ({duration:.1f}s)', flush=True)


if __name__ == '__main__':
    main()
