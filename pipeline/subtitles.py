#!/usr/bin/env python3
"""ShortFactory — Karaoke Subtitle Generator
Creates ASS format subtitles with word-by-word highlighting and background box."""

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
Style: Active,DejaVu Sans,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,3,4,0,2,40,40,120,1
Style: Inactive,DejaVu Sans,64,&H80FFFFFF,&H80FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,3,4,0,2,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def format_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 100)
    return f'{h}:{m:02d}:{s:02d}.{ms:02d}'


def chunk_words(words, chunk_size=4):
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunks.append(words[i:i + chunk_size])
    return chunks


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

    print(f'✨ Generating subtitles: {len(words)} words...', flush=True)

    chunks = chunk_words(words, args.chunk_size)
    events = []

    for chunk in chunks:
        chunk_start = chunk[0]['start']
        chunk_end = chunk[-1]['end']

        for word in chunk:
            word_start = word['start']
            word_end = word['end']
            highlight_text = ''
            for w in chunk:
                if w == word:
                    highlight_text += f'{{\\c&H00FFE1FF&}}{w["word"]}{{\\c&HFFFFFF&}} '
                else:
                    highlight_text += f'{w["word"]} '

            highlight_text = highlight_text.strip()
            events.append(
                f'Dialogue: 0,{format_time(word_start)},{format_time(word_end)},Active,,0,0,0,,{highlight_text}'
            )

        inactive_text = ' '.join(f'{{\\c&H808080&}}{w["word"]}' for w in chunk)
        events.append(
            f'Dialogue: 0,{format_time(chunk_start)},{format_time(chunk_end)},Inactive,,0,0,0,,{inactive_text}'
        )

    with open(args.output, 'w') as f:
        f.write(ASS_HEADER)
        for event in events:
            f.write(event + '\n')

    print(f'✅ Subtitles saved: {args.output} ({len(events)} events)', flush=True)


if __name__ == '__main__':
    main()
