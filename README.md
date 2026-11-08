<p align="center"><img src="build/icon.png" width="96" alt="Inkframe icon" /></p>

# Inkframe

A Windows desktop app that turns a voiceover into an explainer video: hand-drawn, 3D, or a fast tech remix made of
real screenshots, posts, code, memes and GIFs. It can also find a viral idea, write the script and speak it for you.

## Download
Get **Inkframe-Setup-x.y.z.exe** from the [latest release](https://github.com/Kirisos-Guna/inkframe/releases/latest)
and run it. The installer is not code-signed yet, so Windows SmartScreen may warn you the first time: click
**More info → Run anyway**. Then install the Claude Code CLI and run `claude` once in a terminal to sign in.

## What it does
You drop the audio and describe the video like you would to a director. Claude Code on your own computer splits it
into parts, draws each part as an animated scene, checks it, renders it and puts it together with your voice. Then
you click any part, leave a comment, and only that part is made again.

- **Styles:** 31 looks: hand-drawn explainers, ink-and-wash cartoons, living ink, cut-paper posters, shadow puppets,
  cutaways, paper cut-outs, 2D animation, cartoon music videos, dark systems diagrams, and **real 3D** with three.js
  (paper plane, pop-up book, blueprint builds, pencil sketches, little worlds, interactive explainers). Learn a new look
  from a video file or a channel link, and delete the ones you don't use (library styles can be brought back).
- **Fast Tech Remix:** a fast, funny explainer cut from **real media** found on the web: docs and articles with the key
  sentence highlighted, real posts, photos, charts, code in an editor, and a few memes and GIFs. Real references come
  first; reactions are kept to about one every 45 seconds. Meme captions go in each template's own boxes (Drake's
  panels, Gru's boards), and about half the GIFs are anime reactions (with a free GIPHY key). Every shot stays up long
  enough to read.
- **Two engines:** React scenes (Remotion, for drawn lines and three.js 3D) and HTML scenes
  ([HyperFrames](https://github.com/heygen-com/hyperframes) + GSAP, for kinetic type, charts and motion graphics).
  Pick per video or per part.
- **Engaging finish:** animated captions (Clean, Bold pop, Karaoke), transitions between parts, and background music
  that ducks under the voice.
- **Pause and resume** while it works.
- **Hand-made look:** lines in the hand-drawn styles get natural pen irregularity and a gentle line boil, text is
  written in a real handwriting font, and the method steers Claude away from the usual AI clichés.
- **Checks that fix themselves:** every part is checked (black frames, cut-off text, things off screen, shots too fast
  or held too long). On High, a failing part gets up to two automatic fixes, and the fixer sees the checker's picture.
- **Uses your graphics card:** parts are drawn on the GPU, and the finished video is encoded on it (Intel Quick Sync,
  NVIDIA NVENC or AMD AMF), falling back to the processor.
- **Updates inside the app:** new versions are found on GitHub and installed with one click.
- **Publish:** thumbnails drawn in the video's style; titles, a description with chapters, and tags; captions as .srt
  and .vtt. Writing is done by **Claude Code** or **Codex**, your choice.
- **Find a viral idea:** reads what is trending in tech right now, with real numbers (Hacker News, Reddit, GitHub
  trending, YouTube's most viewed this week, Lobsters, dev.to, Techmeme, Google News). The writer then checks the
  strongest stories on the web, including what X, Instagram and TikTok say about them, and ranks the 3 best video
  ideas. Pick one and it becomes your topic, with its angle, facts and sources.
- **Script writer:** research a topic on the web and write the script, or recreate a YouTube video's concept in new
  words. Scripts follow one thread from a relatable opening to a payoff, in a dry, quick channel voice.
- **Voiceover on this PC:** a free, offline voice ([Kokoro](https://huggingface.co/hexgrad/Kokoro-82M)) speaks the
  script, with 12 voices and pace and pitch controls. English only; the model (about 160 MB) downloads once.

The name lives in one place: [src/shared/brand.ts](src/shared/brand.ts).

## What you need
- **Node.js 22+** (for development)
- **Claude Code**, signed in once. The app finds it on PATH, in `~/.local/bin`, in npm's folder, or inside the
  Claude desktop app. Runs on your Claude plan; no API key.
- Optional: the **Codex** app or CLI, signed in, as a second writer (and a second video maker).
- Optional: free **Pexels**, **Pixabay** and **GIPHY** keys for stock clips and reaction GIFs in Fast Tech Remix
  (Settings).
- Everything else comes by itself on first use: FFmpeg is built in; whisper.cpp (~150 MB with its model), Remotion's
  and HyperFrames' headless browsers download the first time they are needed.
- yt-dlp (for links, recreating videos and YouTube trends) and the voice model also download by themselves the first
  time they are needed.

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
| Real media | Fast Tech Remix only: the writer plans real pages, posts, photos, charts, code, memes and GIFs for each part, then they are fetched and screenshotted on this PC | [mediaPlan.ts](src/main/services/job/mediaPlan.ts), [realMedia.ts](src/main/services/realMedia.ts), [memes.ts](src/shared/memes.ts) |
| Checks | FFmpeg finds black frames and shots too fast or too long; Claude looks at three frames of each part for cut-off text, things off screen, etc. On High, a failing part gets up to two automatic fixes | [checks.ts](src/main/services/job/checks.ts), [finalCheck.ts](src/main/services/job/finalCheck.ts) |
| Render | Remotion or HyperFrames renders each part | [render.ts](src/main/services/render.ts), [hyperframes.ts](src/main/services/hyperframes.ts) |
| Finish | One FFmpeg pass, encoded on the GPU when it can: transitions, burned-in captions, sound effects, music ducking, and your voice | [media.ts](src/main/services/media.ts) `finishVideo`, [captions.ts](src/main/services/captions.ts) |
| Changes | Comments on parts are sent together. *Fix just this* edits the scene; *Rethink the scene* draws it again | `addComment` |
| Publish | Thumbnails, titles and description, captions, script | [publish.ts](src/main/services/publish.ts) |
| Ideas | Trending tech from 8 public sources, checked on the web and ranked into 3 video ideas | [trends.ts](src/main/services/trends.ts) |
| Voice | The script spoken offline with Kokoro, pitched and levelled with FFmpeg | [localVoice.ts](src/main/services/localVoice.ts) |

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
FAKE=1 node scripts/drive.mjs make run voice.wav  # the same with a stand-in for Claude: no tokens used
```

## Licences
Remotion is free for individuals and companies of up to 3 people; larger companies need a
[Remotion company licence](https://www.remotion.dev/license). whisper.cpp and FFmpeg are open source.
HyperFrames is Apache-2.0 (its anonymous telemetry is turned off by Inkframe). GSAP is free to use under its
[standard licence](https://gsap.com/standard-license). three.js and rough.js are MIT; the Inter, Caveat, Baloo Thambi 2, Anton and JetBrains Mono fonts are under the SIL Open Font Licence, Permanent Marker under the Apache Licence 2.0, Prism (code colours) is MIT, and MediaPipe with its selfie segmentation model (photo cut-outs) is Apache-2.0. The Kokoro voice model, kokoro-js and
Transformers.js are Apache-2.0, and ONNX Runtime is MIT. Photos come from Wikimedia Commons (credited in the
description), meme templates from Imgflip, and GIFs from GIPHY.
