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
    return '{}:{:02d}:{:02d}.{:02d}'.format(h, m, s, ms)


def chunk_words(words, chunk_size=4):
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunks.append(words[i:i + chunk_size])
    return chunks


def build_highlight_text(chunk, highlight_word, active_hl, active_norm, blur):
    """Build ASS text with word-by-word highlighting. Avoid f-strings with braces."""
    parts = []
    for w in chunk:
        word_text = w['word']
        if w == highlight_word:
            # Highlighted word: {\c&H00FFE1FF&}{\blur3}word{\c&H00FFFFFF&}{\blur3}
            tag_open = '\\c' + active_hl
            tag_close = '\\c' + active_norm
            if blur:
                tag_open += '\\blur3'
                tag_close += '\\blur3'
            parts.append('{' + tag_open + '}' + word_text + '{' + tag_close + '}')
        else:
            parts.append(word_text)
    return ' '.join(parts)


def build_inactive_text(chunk, inactive_color):
    """Build ASS text for inactive subtitle line."""
    parts = []
    for w in chunk:
        parts.append('{\\c' + inactive_color + '}' + w['word'])
    return ' '.join(parts)


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

    print('✨ Generating subtitles (' + args.style + ' style): ' + str(len(words)) + ' words...', flush=True)

    chunks = chunk_words(words, args.chunk_size)
    events = []

    for chunk in chunks:
        chunk_start = chunk[0]['start']
        chunk_end = chunk[-1]['end']

        for word in chunk:
            word_start = word['start']
            word_end = word['end']
            highlight_text = build_highlight_text(
                chunk, word,
                style['active_highlight'],
                style['active_normal'],
                style['blur']
            )
            events.append(
                'Dialogue: 0,' + format_time(word_start) + ',' + format_time(word_end) + ',Active,,0,0,0,,' + highlight_text
            )

        inactive_text = build_inactive_text(chunk, style['inactive_color'])
        events.append(
            'Dialogue: 0,' + format_time(chunk_start) + ',' + format_time(chunk_end) + ',Inactive,,0,0,0,,' + inactive_text
        )

    with open(args.output, 'w') as f:
        f.write(style['header'])
        for event in events:
            f.write(event + '\n')

    print('✅ Subtitles saved: ' + args.output + ' (' + str(len(events)) + ' events)', flush=True)


if __name__ == '__main__':
    main()
