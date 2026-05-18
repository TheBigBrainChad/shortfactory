# ShortFactory

Autonomous YouTube Shorts pipeline. Pick a topic, produce a video, upload — all from a web UI.

[Demo](#) • [Setup](#setup) • [Pipeline](#pipeline) • [API Keys](#api-keys)

## What it does

ShortFactory is a self-hosted tool that turns text topics into YouTube Shorts.

You pick a topic (or type your own), edit the script, choose a voice and background clip, and hit **Produce**. The pipeline runs entirely on your machine — no external video editor, no cloud rendering.

## Pipeline

```
Topic → Script (Gemini) → Voiceover (edge-tts) → Transcription (Whisper)
  → Subtitles (ASS) → Render (FFmpeg) → Thumbnail → YouTube Upload
```

Each stage streams live logs to the web UI. You can cancel mid-run if something goes wrong.

| Stage | Tool | Input | Output |
|-------|------|-------|--------|
| Script | Google Gemini | Topic + hook | Title, script, tags, description |
| Voiceover | edge-tts | Script text | `voiceover.mp3` |
| Transcription | OpenAI Whisper | `voiceover.mp3` | Word-level timestamps (JSON) |
| Subtitles | Python/ASS | Timestamps + script | `subtitles.ass` (karaoke-style) |
| Render | FFmpeg + libass | Background clip + audio + subs | `output.mp4` (1080×1920, ≤59s) |
| Thumbnail | Python Pillow | First frame + title text | `thumbnail.png` |
| Upload | YouTube Data API v3 | Video + metadata | YouTube Short |

## Requirements

- **Node.js** 18+ (tested on 20)
- **Python** 3.9+ with `edge-tts`, `openai`, `pillow`
- **FFmpeg** 5.0+ with `libx264`, `libass`, `aac`
- **SQLite** (bundled via `better-sqlite3`)
- **Linux** (x86_64 or arm64). macOS might work, Windows is untested.

> **Note:** The bundled `better-sqlite3` requires a C++ compiler. If `npm install` fails, install `build-essential` (Debian/Ubuntu) or `base-devel` (Arch).

## Setup

1. **Clone and install**

   ```sh
   git clone https://github.com/TheBigBrainChad/shortfactory.git
   cd shortfactory
   npm install
   ```

2. **Install Python dependencies**

   ```sh
   pip install -r pipeline/requirements.txt
   ```

   Or individually:
   ```sh
   pip install edge-tts openai pillow
   ```

3. **Install FFmpeg**

   Debian/Ubuntu:
   ```sh
   sudo apt install ffmpeg
   ```

   Or use [yt-dlp's static build](https://github.com/yt-dlp/yt-dlp/wiki/Installation#ffmpeg) if your distro ships an old version.

4. **Install yt-dlp** (for downloading background clips from YouTube)

   ```sh
   curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/.local/bin/yt-dlp
   chmod +x ~/.local/bin/yt-dlp
   ```

5. **Configure environment**

   ```sh
   cp .env.example .env
   ```

   Edit `.env` and fill in at least:
   - `GEMINI_API_KEY`
   - `OPENAI_API_KEY`
   - `BRAVE_API_KEY`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`

6. **Build and start**

   ```sh
   npm run build
   npm run start
   ```

   The app runs on `http://localhost:3000`. Default login: `admin` / whatever you set `ADMIN_PASSWORD` to.

## Using the Studio

1. **Topic** — Pick from AI-generated suggestions or enter your own.
2. **Script** — Edit the generated script. Aim for 120–150 words (~45–55s).
3. **Configure** — Choose a voice (with live preview) and background clip. Search YouTube directly, or pick from locally stored clips.
4. **Produce** — Pipeline runs. Logs stream in real time.
5. **Preview** — Watch the video, download, or upload to YouTube.

## Background Clips

The Studio can search YouTube via Brave Search API and download clips automatically with yt-dlp (720p, ≤500MB). Or place your own `.mp4` files in `media/gameplay/` — the renderer will pick one at random if you don't select a specific clip.

## YouTube Upload

Go to **Settings → YouTube** and connect your channel. OAuth2 tokens are stored in the database. Once connected, any produced video can be uploaded directly from the Studio or Library.

## API Keys

| Service | Used For | Get Key At |
|---------|----------|------------|
| Google Gemini | Script generation | [aistudio.google.com](https://aistudio.google.com) |
| OpenAI | Whisper transcription | [platform.openai.com](https://platform.openai.com) |
| Brave Search | YouTube background search | [brave.com/search/api](https://brave.com/search/api) |
| YouTube Data API | Uploading videos | [Google Cloud Console](https://console.cloud.google.com) |

## Architecture

- **Frontend:** Next.js 14 App Router, vanilla CSS (no Tailwind), Canvas 2D charts
- **Backend:** Next.js API routes, `better-sqlite3`, JWT auth
- **Pipeline:** Python scripts orchestrated from Node.js via `child_process.spawn`
- **Scheduler:** `node-cron` for optional auto-production

## Environment Variables

See `.env.example` for all options. Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | Required for script generation |
| `OPENAI_API_KEY` | — | Required for Whisper transcription |
| `BRAVE_API_KEY` | — | Required for YouTube background search |
| `GAMEPLAY_DIR` | `./media/gameplay` | Where background clips are stored |
| `DATA_DIR` | `./data` | SQLite DB and media output |
| `AUTO_SCHEDULE_ENABLED` | `false` | Enable cron-based auto-production |
| `AUTO_SCHEDULE_CRON` | `0 10 * * *` | Cron expression for auto-run |

## Development

```sh
# Install deps
npm install

# Dev server (may crash on low-memory systems — use build + start instead)
npm run dev

# Production build
npm run build
npm run start
```

## Troubleshooting

**FFmpeg crashes with `exit code 234`**  
Your FFmpeg build might have an incompatible libass version. Try the Jellyfin FFmpeg build or a static build from [johnvansickle.com](https://johnvansickle.com/ffmpeg/).

**"No gameplay clips found" during render**  
Either select a background clip in the Studio, or place `.mp4` files in `media/gameplay/`.

**Subtitles don't appear**  
Ensure `DejaVu Sans` font is installed (`fc-list | grep DejaVu`). The renderer uses libass via FFmpeg's `subtitles` filter.

**OpenAI key shows as invalid**  
The key must be a project key (`sk-proj-...`), not a legacy user key.

## License

MIT
