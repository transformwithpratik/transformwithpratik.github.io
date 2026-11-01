---
name: transform-with-pratik
description: Shared brand context and workstream playbooks for Transform with Pratik (fitness coaching brand). Use for any task on client onboarding, reels/YouTube scripts, fitness research, or the website.
---

# Transform with Pratik — Shared Context Skill

> **Updatable file.** When a decision is made in any workstream, update the
> relevant section and add a line to the Changelog at the bottom. Keep this file
> under ~400 lines; move long material into `references/` and link it.

## 0. Working rules (always apply)

1. **Capture every correction.** Whenever Pratik asks to edit or correct
   something (content, brand fact, code behaviour, tone, a script), do both:
   - save the correction to Claude's project memory, and
   - update this file in the same change: fix the affected section and add a
     Changelog line `YYYY-MM-DD — correction — what changed`.
2. **Commit, don't just chat.** Changes to this file and the website are
   committed to `transformwithpratik/transformwithpratik.github.io`
   (default branch `main`). Reference the related issue on the GitHub board
   (github.com/users/transformwithpratik/projects/1) when one exists.
3. **Read before acting.** Start every workstream session by reading this file;
   end it by updating that workstream's status line.

## 1. Brand snapshot (source of truth)

| Field | Value |
|---|---|
| Owner | Pratik Jain — SWE @ Google, certified fitness coach |
| Brand | Transform with Pratik |
| Instagram | @transform.withpratik (formerly @get.fitwithpratik) |
| Website | transformwithpratik.github.io → migrating to Vercel |
| GitHub | github.com/transformwithpratik |
| Audience | Busy working professionals in India, esp. software engineers |
| Promise | Sustainable, structured, measurable fitness that fits real life |
| Pillars | Science-backed fitness · Form & training · Vegetarian high-protein nutrition · Transformation & coaching · Lifestyle & habits · Travel & active living · Tech & fitness |
| Voice | Direct, practical, science-backed, natural Hinglish where it fits; no hype, no crash-diet or body-shaming language |

**Funnel:** Instagram/YouTube discovery → value content → website/DM → qualify → consult → onboard → transformation → testimonial/referral.

**Non-negotiables**
- Never invent qualifications, testimonials, client results, citations or statistics.
- Cite real studies (prefer systematic reviews/meta-analyses); say when evidence is preliminary.
- No fake urgency, guaranteed outcomes or pressure selling.
- Google-related content must follow Google's employee social media and
  confidentiality policies — confirm with the policy before filming office,
  benefits, or using Google branding/tags. (Status: **TO VERIFY**)

## 2. Workstreams

Each workstream runs in its own chat/session. Before starting, read this file and
the workstream's doc in `docs/workstreams/` (scope, open questions, kickoff
prompt, log); after finishing, update that doc and the status line here.

### WS1 — Client onboarding
- Assets: intake Google Form, onboarding doc, diet-plan template, check-in sheet, welcome message.
- Intake must cover: goals, training history, schedule/work hours, diet type (veg/non-veg/eggs), injuries/medical clearance, sleep, steps, budget/plan tier.
- Diet plans: calorie + protein targets from intake; vegetarian-first; Indian food examples; medical conditions → refer to doctor.
- Status: _not started_

### WS2 — Reels (Instagram)
Series (keep formats repeatable):
1. Travel reels — active travel, staying fit on trips
2. Fitness series — form fixes, myth-busting, training principles
3. Google-as-platform content — **policy check first** (see non-negotiables)
4. Tech × fitness — wearables, apps, AI, tracking
5. Lifestyle — routines, sleep, office-day nutrition
6. Google office & benefits — **policy check first**

Every script uses this template:
```
Series / episode:
Audience problem:
Hook (0–3s):
Body (what → why → what to do):
Evidence (study + 1-line takeaway):
Visuals / B-roll / on-screen text:
Edit notes (cuts, captions, music mood):
Caption (keywords first line):
CTA:
Goal: reach | trust | engagement | leads
```

**Editing reels:** follow `references/reel-editing.md` (source footage, takes, house
style, visuals, transitions, music mix, thumbnail, QA), `references/instagram-reels.md`
(Instagram specs, safe zones, ranking signals, retention checklist) and reuse the
3D motion-graphics kit in `scripts/reel3d/`. Key rules:
- Edit from the original camera files, never from a re-uploaded export.
- Section changes dip out then in — no overlapping crossfades.
- Opening moves (e.g. chair turn) at natural speed, not heavily sped up.
- When reusing text from an old export, copy only the letters + outline — never background.
- Original/royalty-free music ≈10 dB under the voice, ducked while speaking; final −14 LUFS.
- Reel cover: 1080×1920 black + yellow, hook on top, face clear, key content inside the centre 3:4.
- Status: _blood-flow reel v4 delivered; V1 "walk after meals" v1 edited 2026-11-01 (3D graphics, intense music)_

### WS3 — Website (Vercel)
- Repo layout (as of 2026-11-01, platform upgrade, PR `platform-upgrade`): folder-per-page clean URLs (`/calculator/`, `/book/`, `/transformations/`, `/feedback/`, `/nutrition/`, `/library/`, `/workouts/`, `/about/`, `/contact/`, `/privacy/`), client portal `portal/*/`, coach dashboard `admin/` (hash routes), `css/site.css` (public) + `css/app.css` (portal/admin, dark), `js/lib|pages|portal|admin/`, shared `partials/` synced by `scripts/sync-partials.mjs`, `supabase/migrations/` (source of truth for the DB; `schema.sql` is legacy), `supabase/functions/` (send-email, delete-account), tests in `tests/` (`npm test`, `node tests/e2e/run.mjs`). Setup and owner-only steps: `SETUP-V3.md`.
- Supabase project `trerqtscrsrlcfsnfetn`: RLS on every table, roles client/coach/admin, new sign-ups pending until approved, private photo/plan buckets with signed URLs, audit log, email outbox → `send-email` edge function (needs RESEND_API_KEY or BREVO_API_KEY secret), daily reminders gated by Site settings (off by default).
- Design system: charcoal #171A18 / #242925, lime #B8F36B, off-white #F5F5F0, muted #898F87; Archivo. Site brand name in the UI is GetFitWithPratik.
- Content rules on the site: no unverifiable stats (old "200+ clients", "98%" etc. removed); transformations need recorded written consent; reviews need consent + approval; coach stats/credentials are editable in admin Site settings.
- Personal apps: `apps/lean-bulk-daily/` — Pratik's installable daily checklist PWA (local storage only, no sign-in yet; Google sign-in could reuse the Supabase setup later). Self-contained; don't link it from the main nav unless asked. Plate-photo macro logging calls Gemini (default `gemini-3.6-flash`) or Claude directly from the browser with the user's own API key, stored only on their device and excluded from backups. Never commit a key. End-of-day macro check reminder is in-app; true background push would need a server (e.g. Supabase cron + Web Push).
- Still to do: Supabase Auth URLs + custom SMTP, email provider key, Google OAuth, WhatsApp number/prices/photo in Site settings, then switch on reminders (all in SETUP-V3.md); Vercel move; analytics.
- Status: _platform upgrade built and browser-tested (fake backend); DB changes live; PR open for review_

### WS4 — YouTube launch
- Decide: channel name (consistent with IG handle decision), positioning, format mix (long-form explainers + Shorts repurposed from reels), upload cadence, thumbnail style.
- Status: _not started_

### WS5 — Trend research & scripting
- Weekly: find trending fitness topics (IG/YouTube/Google Trends), back each with research, output ready-to-shoot scripts in the WS2 template, with edit notes.
- Status: _not started_

## 3. Decisions log
_Add decisions as `YYYY-MM-DD — WSx — decision`._
- 2026-10-30 — WS2 — Instagram handle is now @transform.withpratik.
- 2026-11-01 — WS2 — reel editing playbook adopted (`references/reel-editing.md`).
- 2026-11-01 — WS3 — platform upgrade: Supabase-backed leads, reviews, transformations, portal and coach dashboard; emails via outbox + edge function; reminders off until launch; optional data-retention job not applied (owner decision).

## 4. Open questions
- Brand name: site says "GetFitWithPratik", Project says "Transform with Pratik" — which one?
- New YouTube handle? (Instagram decided: @transform.withpratik)
- Coaching plan tiers and pricing?
- Which qualifications/certifications to display (exact names)?
- Google social media policy constraints for workplace content?

## Changelog
- 2026-10-20 — v0.1 created: brand snapshot, 5 workstreams, script template.
- 2026-10-20 — v0.2: added working rules (capture corrections in memory + this file, commit to GitHub), recorded website repo layout.
- 2026-10-20 — v0.3: created 5 workstream docs in docs/workstreams/ with initial context and kickoff prompts; recorded website audit and brand-name question.
- 2026-10-21 — v0.4: deployed Lean Bulk Daily PWA to apps/lean-bulk-daily/.
- 2026-10-26 — v0.5: Lean Bulk Daily adds plate-photo macro estimation (carbs/fat tracking) and an end-of-day macro check reminder.
- 2026-10-30 — correction — Instagram handle updated to @transform.withpratik in the brand snapshot.
- 2026-10-31 — correction — reel edits: use the original camera footage (re-uploaded exports go blurry); slow the opening chair turn to natural speed; no overlap between habit transitions (dip out, then in).
- 2026-11-01 — correction — when rebuilding a sharp intro, transplant only caption letters, never background pixels (fixed broken pixels in the intro).
- 2026-11-01 — v0.6: added reel editing playbook `references/reel-editing.md` and WS2 editing rules.
- 2026-11-01 — v0.7: added `references/instagram-reels.md` (Instagram editing standards), the 3D motion-graphics + audio kit `scripts/reel3d/`, and take-checking / intense-music notes in the reel playbook (walk-after-meals reel).
- 2026-11-01 — v0.8: WS3 updated for the platform upgrade (new repo layout, Supabase setup, content rules, remaining owner steps in SETUP-V3.md).
