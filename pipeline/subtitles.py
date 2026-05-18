#!/usr/bin/env python3
"""ShortFactory — Karaoke Subtitle Generator
Word-by-word karaoke: active word pops yellow + 110%, rest stay white.
Font: Montserrat 56pt bold, centered at 45% from top of 1080x1920.
Subtitles are ALWAYS visible — no gaps between words or chunks."""

import argparse
import json


ASS_HEADER = """[Script Info]
Title: ShortFactory Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Montserrat,56,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

# Colors in ASS BGR format
YELLOW = '&H0000FFFF&'
WHITE = '&H00FFFFFF&'


def format_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 100)
    return '{}:{:02d}:{:02d}.{:02d}'.format(h, m, s, ms)


def chunk_words(words, chunk_size=4):
    """Split words into chunks of `chunk_size`."""
    return [words[i:i + chunk_size] for i in range(0, len(words), chunk_size)]


def build_karaoke_line(chunk, active_index):
    """Build one Dialogue text line where the active word is yellow+scaled.
    All override tags are wrapped in braces so libass parses them, not renders them."""
    parts = ['{\\an5\\pos(540,864)}']
    for idx, word in enumerate(chunk):
        text = word['word']
        if idx == active_index:
            parts.append('{\\c' + YELLOW + '\\fscx110\\fscy110}' + text + '{\\c' + WHITE + '\\fscx100\\fscy100}')
        else:
            parts.append('{\\c' + WHITE + '\\fscx100\\fscy100}' + text)
    return ' '.join(parts)


def main():
    parser = argparse.ArgumentParser(description='Generate ASS karaoke subtitles')
    parser.add_argument('--transcript', required=True, help='Transcript JSON file')
    parser.add_argument('--output', required=True, help='Output ASS file')
    parser.add_argument('--chunk-size', type=int, default=4, help='Words per subtitle line')
    args = parser.parse_args()

    with open(args.transcript) as f:
        transcript = json.load(f)

    words = transcript.get('words', [])
    if not words:
        raise ValueError('No words found in transcript')

    print('✨ Generating karaoke subtitles: ' + str(len(words)) + ' words...', flush=True)

    chunks = chunk_words(words, args.chunk_size)
    events = []

    for chunk_idx, chunk in enumerate(chunks):
        for active_idx in range(len(chunk)):
            word = chunk[active_idx]
            start = word['start']

            # Gapless: extend event to the next word's start time.
            # This ensures subtitles never disappear between words or chunks.
            if active_idx < len(chunk) - 1:
                # Next word in same chunk
                end = chunk[active_idx + 1]['start']
            elif chunk_idx < len(chunks) - 1:
                # Last word of chunk — extend to first word of next chunk
                end = chunks[chunk_idx + 1][0]['start']
            else:
                # Very last word in entire script
                end = word['end']

            text = build_karaoke_line(chunk, active_idx)
            events.append(
                'Dialogue: 0,' + format_time(start) + ',' + format_time(end) + ',Default,,0,0,0,,' + text
            )

    with open(args.output, 'w') as f:
        f.write(ASS_HEADER)
        for event in events:
            f.write(event + '\n')

    print('✅ Subtitles saved: ' + args.output + ' (' + str(len(events)) + ' events)', flush=True)


if __name__ == '__main__':
    main()
