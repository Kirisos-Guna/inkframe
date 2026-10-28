<p align="center"><img src="build/icon.png" width="96" alt="Inkframe icon" /></p>

# Inkframe

A Windows desktop app that turns a voiceover into a hand-drawn explainer video.

## Download
Get **Inkframe-Setup-x.y.z.exe** from the [latest release](https://github.com/Kirisos-Guna/inkframe/releases/latest)
and run it. The installer is not code-signed yet, so Windows SmartScreen may warn you the first time: click
**More info → Run anyway**. Then install the Claude Code CLI and run `claude` once in a terminal to sign in.

## What it does
You drop the audio and describe the video like you would to a director. Claude Code on your own computer splits it
into parts, draws each part as an animated scene, checks it, renders it and puts it together with your voice. Then
you click any part, leave a comment, and only that part is made again.

- **Styles:** 30 looks, including all 16 styles from the original (hand-drawn explainers, ink-and-wash cartoons, living
  ink, cut-paper posters, shadow puppets, cutaways, paper cut-outs, character stories, 2D animation, cartoon music
  videos, and **real 3D** with three.js: paper plane, pop-up book, blueprint builds, pencil sketches, little worlds,
  interactive explainers). Or learn a new look from a video file or a channel link.
- **Two engines:** React scenes (Remotion, for drawn lines and three.js 3D) and HTML scenes
  ([HyperFrames](https://github.com/heygen-com/hyperframes) + GSAP, for kinetic type, charts and motion graphics).
  Pick per video or per part.
- **Engaging finish:** animated captions (Clean, Bold pop, Karaoke), transitions between parts, and background music
  that ducks under the voice.
- **Pause and resume** while it works.
- **Hand-made look:** lines in the hand-drawn styles get natural pen irregularity and a gentle line boil, text is
  written in a real handwriting font, and the method steers Claude away from the usual AI clichés.
- **Characters:** a ready-made cast of 12 (scientist, engineer, student, coder, teacher, kid, chef, nurse, grandad…),
  with hair, outfits, facial hair, hats, headphones and age to make your own.
- **Updates inside the app:** new versions are found on GitHub and installed with one click.
- **Publish:** thumbnails drawn in the video's style; titles, a description with chapters, and tags; captions as .srt
  and .vtt. Writing is done by **Codex** (your ChatGPT plan) or Claude Code.
- **Script writer:** research a topic on the web and write the voiceover script before you record.

The name lives in one place: [src/shared/brand.ts](src/shared/brand.ts).

## What you need
- **Node.js 22+** (for development)
- **Claude Code**, signed in once. The app finds it on PATH, in `~/.local/bin`, in npm's folder, or inside the
  Claude desktop app. Runs on your Claude plan; no API key.
- Optional: the **Codex** app or CLI, signed in, for writing (and as a second video maker).
- Everything else comes by itself on first use: FFmpeg is built in; whisper.cpp (~150 MB with its model), Remotion's
  and HyperFrames' headless browsers download the first time they are needed.
- Optional: **yt-dlp** on PATH, only for learning a style from a video or channel link (dropping a file always works).

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
| Parts | Claude splits the voiceover into parts (about one per 9 s), each with a title and an idea | [prompts.ts](src/main/services/prompts.ts) `splitPrompt` |
| Design | Claude reads [METHOD.md](remotion/METHOD.md) or [HYPERFRAMES.md](remotion/HYPERFRAMES.md) and the style, then writes each part as a React scene (with the [scene kit](remotion/kit/index.tsx) and [3D kit](remotion/kit/three.tsx)) or an HTML scene | [pipeline.ts](src/main/services/pipeline.ts), [engines.ts](src/main/services/engines.ts) |
| Checks | Frames are rendered and Claude looks at them for cut-off text, things off screen, etc. On High, a failing part is fixed once | `runCheck` |
| Render | Remotion or HyperFrames renders each part | [render.ts](src/main/services/render.ts), [hyperframes.ts](src/main/services/hyperframes.ts) |
| Finish | One FFmpeg pass: transitions, burned-in captions (drawtext with a bundled font), music ducking, and your voice | [media.ts](src/main/services/media.ts) `finishVideo`, [captions.ts](src/main/services/captions.ts) |
| Changes | Comments on parts are sent together. *Fix just this* edits the scene; *Rethink the scene* draws it again | `addComment` |
| Publish | Thumbnails, titles and description, captions, script | [publish.ts](src/main/services/publish.ts) |

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
HyperFrames is Apache-2.0 (its anonymous telemetry is turned off by Inkframe). GSAP is free to use under its
[standard licence](https://gsap.com/standard-license). three.js and rough.js are MIT; the Inter and Caveat fonts are under the SIL Open Font Licence, and Permanent Marker under the Apache Licence 2.0.
