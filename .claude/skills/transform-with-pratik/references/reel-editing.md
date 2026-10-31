# Reel editing playbook (WS2)

Learned from the "5 daily habits for better blood flow" reel (Oct–Nov 2026).
Follow this for every reel edit; add new corrections here and in the SKILL.md Changelog.

## 1. Source footage
- Always edit from the **original camera files** (iPhone 4K HEVC `.mov`, portrait,
  rotation metadata), never from a re-uploaded export — exports are already compressed
  and get visibly soft/blocky on re-edit. Ask for the raw clip before starting.
- If an earlier export must be reused (e.g. it carries captions you don't have as
  source), rebuild sharp sections from the raw clip:
  1. Align time by cross-correlating the audio (1 s windows) to find raw ↔ edit offsets
     and jump cuts.
  2. Align space with ORB features + `estimateAffinePartial2D` (punch-ins show up as a
     constant scale, e.g. 1.12×); crop that region from the 4K and scale down with Lanczos.
  3. Bring over **only the text pixels** from the export (white/yellow letter fill that
     differs from the clean frame, plus a few px for the black outline). Never paste
     background, hands or body from the export — that causes "broken pixel" patches,
     worst during fast motion.
- One raw clip may cover only part of the reel (the blood-flow raw covered just the
  intro); ask for the other takes if the outro also needs the sharp treatment.

## 2. House style (match it when editing new reels)
- Canvas 1080×1920, 30 fps. Font: **Inter Display** (ExtraBold for captions/handle,
  Black for hooks). White text with black outline + soft drop shadow; brand yellow
  `#F8C83D` for keywords.
- Hook title at top (e.g. "SIT **8+ HOURS** A DAY?"), word-by-word captions around
  y≈1250, name tag "PRATIK JAIN · Software engineer · Fitness coach" on first intro.
- List reels: dark card with a soft gold glow, 5-segment progress bar, yellow number
  badge, title, bullets that build up, captions at the same y.
- Outro: talking head → "SAVE FOR TOMORROW", "FOLLOW @transform.withpratik" (typing
  animation, centred), "COMMENT "<KEYWORD>" FOR THE FULL GUIDE".
- Instagram safe zone: keep key content within y≈220–1500 and away from the right-edge
  buttons; the bottom ~420 px gets covered by username/caption UI.

## 3. Visuals for explainer sections
- Don't use clips pulled from the internet (copyright claims / muted audio). Make
  original animations instead: 3D x-ray "hologram" body (cyan), blood = red glow,
  water = aqua, warmth = amber, accents in brand yellow, on the dark card background.
- Each visual must match what the voice and on-screen text actually claim. If a
  requested visual would overstate the science (e.g. "drinking water lowers BP"), show
  the claim the reel makes (low water → thicker blood) and tell Pratik why.
- Keep the visual's subject in the empty part of the card; text stays readable on top
  (add shadow to extracted text).

## 4. Motion and transitions
- **Between sections, dip — never overlap.** The previous visual fades out completely,
  then the next fades in (≈5 frames out, ≈7 frames in, at the frame the new title
  appears). Crossfades leave shots of the previous habit visible (correction 2026-10-31).
- **Don't heavily speed-ramp the opening move** (e.g. the chair turn). Play it at natural
  speed or slower; shift the rest of the timeline (voice, music, overlays) to make room
  (correction 2026-10-31).

## 5. Music and audio
- Background music must be royalty-free/original (synthesized bed is fine). Offer a
  voice-only export if he wants to use a trending Instagram sound instead.
- Arrangement follows the reel: soft build under the hook → drop when the list starts →
  short swoosh at each section change → calmer bed for calm topics (breathing) → hit
  for the outro CTA → ring-out.
- Mix: voice ≈ −14 LUFS; music bed ≈ −24 LUFS (≈10 dB under), ducks a further −5 dB
  while he speaks; high-pass music at 70 Hz and dip ~2.5 kHz so speech stays clear.
  Final: −14 LUFS integrated, peaks ≤ −1 dBFS.

## 6. Handle and branding
- Current Instagram handle: **@transform.withpratik** (old: @get.fitwithpratik). Replace
  the old handle anywhere it appears; re-type it in the same font/outline/animation.

## 7. Thumbnail / reel cover
- 1080×1920, black + brand-yellow theme. Hook on black at the top ("SITTING
  **8+ HOURS?**"), yellow banner with the promise ("DO THESE 5 THINGS"), sharp frame of
  Pratik from the raw footage below — face never covered by text — and the handle chip.
- Keep everything important inside the centre 3:4 area (y≈240–1680) so the profile-grid
  crop still works.

## 8. QA before delivering
- 1 fps contact sheet of the whole reel; frame-by-frame check of every cut and section
  transition; full-res check of the intro during fast motion.
- Loudness/peak check, audio length matches video, handle correct, nothing important in
  the bottom UI zone.
