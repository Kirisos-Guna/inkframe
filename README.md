<p align="center"><img src="build/icon.png" width="96" alt="Inkframe icon" /></p>

# Inkframe

A Windows desktop app that turns a voiceover into a hand-drawn explainer video.

## Download
Get **Inkframe-Setup-x.y.z.exe** from the [latest release](https://github.com/Kirisos-Guna/inkframe/releases/latest)
and run it. The installer is not code-signed yet, so Windows SmartScreen may warn you the first time: click
**More info → Run anyway**. Then install the Claude Code CLI and run `claude` once in a terminal to sign in.

## What it does You drop the audio and describe
the video like you would to a director. Claude Code on your own computer splits it into parts, draws each part as an
animated scene, checks it, renders it and puts it together with your voice. Then you click any part, leave a
comment, and only that part is made again.

The name lives in one place: [src/shared/brand.ts](src/shared/brand.ts).

## What you need
- **Node.js 20+** (for development)
- **Claude Code**, signed in once. The app finds it on PATH, in `~/.local/bin`, in npm's folder, or inside the
  Claude desktop app. Runs on your Claude plan; no API key. **Codex** works too, as a second maker.
- Everything else comes by itself on first use: FFmpeg is built in; whisper.cpp (~150 MB with its model) and
  Remotion's headless browser download the first time they are needed.
- Optional: **yt-dlp** on PATH, only for learning a style from a video link (dropping a file always works).

## Run it
```bash
npm install
npm run dev
```
Build a Windows installer:
```bash
npm run build:win
```

## How it works
| Step | What happens | Code |
|---|---|---|
| Voiceover | whisper.cpp finds every word and its time, while you write the direction | [transcribe.ts](src/main/services/transcribe.ts) |
| Parts | Claude splits the voiceover into 5–14 s parts, each with a title and an idea | [prompts.ts](src/main/services/prompts.ts) `splitPrompt` |
| Design | Claude reads [METHOD.md](remotion/METHOD.md) and the style, then writes each part as a Remotion scene with the [scene kit](remotion/kit/index.tsx) | [pipeline.ts](src/main/services/pipeline.ts) |
| Checks | Frames are rendered and Claude looks at them for cut-off text, things off screen, etc. On High, a failing part is fixed once | `runCheck` |
| Render | Remotion renders each part; FFmpeg joins them and lays the voiceover on top | [render.ts](src/main/services/render.ts), [media.ts](src/main/services/media.ts) |
| Changes | Comments on parts are sent together. *Fix just this* edits the scene; *Rethink the scene* draws it again | `addComment` |

Claude runs headless (`claude -p --output-format stream-json --permission-mode acceptEdits`) inside each video's
folder and may only read and write files there. Every version of every scene is kept in `scenes/history`, so you
can go back from the History tab.

Videos are saved in `Videos\Inkframe\<name>` by default (change it on the home page or in Settings).

## Keys in the editor
`Space` play · `← →` parts · `C` comment · `L` lock · `Shift`-click to pick several parts · drag on the sound wave
to cut words · drag material onto a part.

## Testing
```bash
npm test                                   # unit tests
npm run build
node scripts/drive.mjs ui shots voice.wav  # screenshots of every page
node scripts/drive.mjs make run voice.wav  # makes a whole video end to end (uses your Claude plan)
```

## Licences
Remotion is free for individuals and companies of up to 3 people; larger companies need a
[Remotion company licence](https://www.remotion.dev/license). whisper.cpp and FFmpeg are open source.
