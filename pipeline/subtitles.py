#!/usr/bin/env python3
"""ShortFactory — Karaoke Subtitle Generator
Creates ASS format subtitles with word-by-word highlighting."""

import argparse
import json


STYLE_PRESETS = {
    'boxed': {
        'header': """[Script Info]
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
""",
        'active_highlight': '&H00FFE1FF&',
        'active_normal': '&H00FFFFFF&',
        'inactive_color': '&H808080&',
        'blur': False,
    },
    'outline': {
        'header': """[Script Info]
Title: ShortFactory Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Active,DejaVu Sans,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,120,1
Style: Inactive,DejaVu Sans,64,&H80FFFFFF,&H80FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,2,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""",
        'active_highlight': '&H00FFE1FF&',
        'active_normal': '&H00FFFFFF&',
        'inactive_color': '&H808080&',
        'blur': False,
    },
    'neon': {
        'header': """[Script Info]
Title: ShortFactory Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Active,DejaVu Sans,64,&H00FFE1FF,&H00FFE1FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,2,2,40,40,120,1
Style: Inactive,DejaVu Sans,64,&H50FFE1FF,&H50FFE1FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""",
        'active_highlight': '&H00FFFFFF&',
        'active_normal': '&H00FFE1FF&',
        'inactive_color': '&H50FFE1FF&',
        'blur': True,
    },
}


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
    parser.add_argument('--style', default='boxed', choices=list(STYLE_PRESETS.keys()), help='Caption style preset')
    args = parser.parse_args()

    style = STYLE_PRESETS.get(args.style, STYLE_PRESETS['boxed'])

    with open(args.transcript) as f:
        transcript = json.load(f)

    words = transcript.get('words', [])
    if not words:
        raise ValueError('No words found in transcript')

    print(f'✨ Generating subtitles ({args.style} style): {len(words)} words...', flush=True)

    chunks = chunk_words(words, args.chunk_size)
    events = []
    blur_tag = '{\\blur3}' if style['blur'] else ''

    for chunk in chunks:
        chunk_start = chunk[0]['start']
        chunk_end = chunk[-1]['end']

        for word in chunk:
            word_start = word['start']
            word_end = word['end']
            highlight_text = ''
            for w in chunk:
                if w == word:
                    highlight_text += f'{{\\c{style["active_highlight"]}}{blur_tag}{w["word"]}{{\\c{style["active_normal"]}}{blur_tag} '
                else:
                    highlight_text += f'{w["word"]} '

            highlight_text = highlight_text.strip()
            events.append(
                f'Dialogue: 0,{format_time(word_start)},{format_time(word_end)},Active,,0,0,0,,{highlight_text}'
            )

        inactive_text = ' '.join(f'{{\\c{style["inactive_color"]}}}{w["word"]}' for w in chunk)
        events.append(
            f'Dialogue: 0,{format_time(chunk_start)},{format_time(chunk_end)},Inactive,,0,0,0,,{inactive_text}'
        )

    with open(args.output, 'w') as f:
        f.write(style['header'])
        for event in events:
            f.write(event + '\n')

    print(f'✅ Subtitles saved: {args.output} ({len(events)} events)', flush=True)


if __name__ == '__main__':
    main()
