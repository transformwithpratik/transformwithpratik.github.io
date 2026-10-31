# reel3d — original 3D motion graphics + full reel assembly

Built for the "walk after meals" reel (2026-11-01). Everything is original (no
stock clips, no third-party music), so nothing can be claimed or muted.
Scripts use absolute paths under `/home/claude/reel/` — change `REEL` paths
before reusing.

## Pipeline
1. **Sources** → `src/hook.mov`, `src/main.mov`, `src/cta.mp4` (original camera files).
   `ffmpeg -i src/X -ac 1 -ar 16000 audio/X.wav` for analysis.
2. **Takes & pauses** (no speech-to-text in the sandbox):
   - Preferred: AI Producer connector → upload card → `get_transcript` (word times).
   - Fallback (used here): `align/` = flite TTS of the script + MFCC + DTW (`dtw.c`,
     `gcc -O3 -o dtw dtw.c -lm`). `syl.py` segments speech and counts syllables;
     `hyp.py` scores which script line best matches a region (lower = better) —
     that's how the repeated "try a 10-minute walk" take was found and dropped.
     `seg_align.py` gives word times per phrase; `build_timeline.py` writes the
     cut list, captions and graphic cues (`timeline.json`, `gfx/timeline.js`).
3. **Graphics** → `gfx/` is a no-dependency WebGL2 engine (shadows, bloom,
   hologram/metal/clay materials) run in headless Chromium (SwiftShader).
   `scenes.js` holds the scenes: `meal` (dal-chawal-sabzi-roti thali + glucose
   spike graph), `curious` (gold 3D "?"), `walk` (walker + sit vs walk curves),
   `muscle` (x-ray thigh, contracting fibres pulling glucose from a vessel),
   `body` (hologram walker, glucose flowing to leg muscles), `couch` (✗),
   `walk10` (10-min ring ✓), `norun` (runner ✗), `easy` (pace gauge).
   `main.js` composites titles, captions, name tag, WHY?/JUST MOVE!, CTA.
   Test: `node test_all.js scene:t:dur ...` → `frames/sheet.jpg`.
   Render: `node render_all.js 0 2 & node render_all.js 1 2` → `ov/f%05d.png`
   (RGBA, ~1.2 s/frame/worker at 1080×1920, 3D at 0.7 internal scale).
4. **A-roll** → `base.py` (frame-exact cuts, punch-ins, light grade).
5. **Audio** → `voice.py` (per-source level match, de-noise, EQ, de-ess,
   compression, −16 LUFS), `music.py` (synthesised track that follows the
   timeline: build → drop → break → stop on "Why?" → drop → ring-out),
   `sfx.py` (whoosh/pop/click/ding/buzz/impact/typing at timeline cues),
   `mix.sh` (sidechain duck, −14 LUFS, −1.2 dBTP).
6. **Final** → `ffmpeg -i base.mp4 -framerate 30 -i ov/f%05d.png -i aud/mix.wav
   -filter_complex "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p"
   -c:v libx264 -crf 17 -c:a aac -b:a 256k -movflags +faststart out.mp4`
