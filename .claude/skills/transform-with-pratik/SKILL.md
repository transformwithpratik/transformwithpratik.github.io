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
| Instagram | @get.fitwithpratik (handle change under consideration) |
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
- Status: _not started_

### WS3 — Website (Vercel)
- Repo layout (as of 2026-10-20): `index.html`, `css/`, `js/` (main, portal, supabase-client), `pages/` (calculator, book, transformations, feedback, admin), `portal/` (client login/signup, dashboard, plan, log, weekly, history, files), `supabase/schema.sql`. A Supabase-backed client portal already exists — extend it rather than rebuild.
- Inspect existing site before changing anything; preserve the calorie calculator logic, fix its page.
- Tasks: clean metadata (title, description, OG/Twitter cards, JSON-LD), refresh look & feel, deploy to Vercel, Google Sign-In, fix calculator page, add client tools (e.g. TDEE/macro calculator, protein planner, progress tracker, enquiry/application form).
- SEO: one primary keyword per page, fast mobile load, embed reels/YouTube, link from Instagram bio.
- Repo conventions: keep a `CLAUDE.md` at repo root pointing to this skill.
- Status: _audit done (see docs/workstreams/ws3-website.md); next: brand decision, Supabase safety check, calculator fix_

### WS4 — YouTube launch
- Decide: channel name (consistent with IG handle decision), positioning, format mix (long-form explainers + Shorts repurposed from reels), upload cadence, thumbnail style.
- Status: _not started_

### WS5 — Trend research & scripting
- Weekly: find trending fitness topics (IG/YouTube/Google Trends), back each with research, output ready-to-shoot scripts in the WS2 template, with edit notes.
- Status: _not started_

## 3. Decisions log
_Add decisions as `YYYY-MM-DD — WSx — decision`._

## 4. Open questions
- Brand name: site says "GetFitWithPratik", Project says "Transform with Pratik" — which one?
- New Instagram/YouTube handle?
- Coaching plan tiers and pricing?
- Which qualifications/certifications to display (exact names)?
- Google social media policy constraints for workplace content?

## Changelog
- 2026-10-20 — v0.1 created: brand snapshot, 5 workstreams, script template.
- 2026-10-20 — v0.2: added working rules (capture corrections in memory + this file, commit to GitHub), recorded website repo layout.
- 2026-10-20 — v0.3: created 5 workstream docs in docs/workstreams/ with initial context and kickoff prompts; recorded website audit and brand-name question.
