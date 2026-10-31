# Instagram Reels editing standards

Use with `reel-editing.md` (house style + past corrections). This file is the
platform layer: what Instagram needs and what keeps people watching. Last checked
2026-11-01; re-check the specs every few months.

## 1. Export specs
- 1080×1920, 9:16, 30 fps (60 only if the camera footage is 60), H.264 High,
  yuv420p, AAC 48 kHz ≥128 kbps, `-movflags +faststart`. Keep files well under 4 GB.
- Loudness: −14 LUFS integrated, true peak ≤ −1 dBTP.
- Reels can run up to 3 min in-app, but our explainers work best at 25–45 s.
- Cover: 1080×1920; the profile grid shows the centre 3:4 (1080×1440), so keep
  the face and hook inside y≈240–1680.

## 2. Safe zones (1080×1920)
- Top ~270 px: progress bar / "Reels" header. Titles go at y≈220–420 at most.
- Bottom ~420–670 px: username, caption, audio label. Keep all key text above
  y≈1450. Spoken captions sit at y≈1250 (house style).
- Right ~230 px from y≈1150 down: like/comment/share rail. Keep chips and
  pointers out of the bottom-right corner.
- Sides: 65 px margin.

## 3. What the ranking rewards (Instagram's own guidance)
- Watch time, likes and sends/shares are the main signals for both followers
  and non-followers. Original, non-watermarked content made for Instagram. Strong
  hook. Trial Reels (shown to non-followers first) are a good way to test a hook.
- So: never upload exports with another app's watermark; re-export clean.

## 4. Retention editing checklist
1. **Hook in 0–1.5 s**: face + bold title on screen from frame 1 (no logo
   intro, no fade-in from black). Title ≤ 6 words, keyword in brand yellow.
2. **Cut every pause**: remove dead air > ~0.25 s between phrases, keep ~0.12–0.18 s
   breaths. Remove false starts and repeated takes (keep the clean last take).
3. **Something changes every 1–3 s**: a new shot, a graphic, a zoom, a chip,
   a caption beat. Never hold a static talking head for more than ~3 s.
4. **Visual = the sentence being spoken**: each graphic shows exactly the line
   it covers (meal → spike, walk → smaller spike, ✗ / ✓ for don't / do).
5. **Pattern interrupts** at the turns of the script ("But here's something
   interesting", "Why?", "Just move!"): music stop or drop, big kinetic word,
   punch-in on the face.
6. **Word-by-word captions** for viewers watching muted:
   ≤ 3 words per chunk, keywords yellow, words pop in as they are spoken.
7. **Sound design**: whoosh on every visual cut, pop/click on chips and labels,
   ding on ✓, low buzz/thud on ✗, impact on the hook title and the final line,
   riser into each drop. Keep effects under the voice (≈ −4 dB on the sfx bus).
8. **Music**: original/royalty-free bed with an arrangement that follows the
   script (build under the hook → drop on the first visual → break at the
   twist → stop on the question → drop again → ring-out). Default bed ≈10 dB
   under the voice and ducked while he speaks; "intense" ≈ 8 dB under.
9. **Loop-friendly ending**: CTA short (≤ 2.5 s), last frame flows back into
   the hook. On-screen CTA = SAVE + FOLLOW @transform.withpratik + COMMENT
   keyword.
10. **QA on a phone-sized preview** (see reel-editing.md §8) before posting.

## 5. Caption (post text) pattern
First line = keyword-rich hook (searchable), 2–4 short lines of value, the comment
keyword CTA, 3–5 specific hashtags. No engagement bait.

## Sources
- Specs & safe zones: hopperhq.com/blog/instagram-reel-size (2026)
- Ranking signals (Mosseri: watch time, likes, sends; original, non-watermarked;
  strong hook; Trial Reels): blog.hootsuite.com/instagram-algorithm (2026)
