# WS1 — Client onboarding

## Goal
A smooth, trustworthy path from "interested" to "active client with a plan" that
works on WhatsApp/IG DMs and the website, and plugs into the existing client portal.

## Existing assets (from repo)
- `pages/book.html` — booking form → Supabase + email + Google Sheets.
- Client portal (`portal/`): signup, dashboard, plan viewer (+PDF), daily log,
  weekly check-in (weight + 3 photos), files, history.
- Admin (`pages/admin.html`): plan editor (macros, workout, diet, supplements),
  logs, check-ins, file pusher, CSV export.

## Deliverables
1. Lead qualification questions (DM + booking form).
2. Intake questionnaire (Google Form, or extend `book.html`) covering goals,
   training history, work hours/schedule, diet type (veg/egg/non-veg), Indian
   food preferences, injuries & medical clearance (PAR-Q style), sleep, steps,
   budget/plan tier, consent for progress photos and testimonial use.
3. Onboarding doc / welcome kit: what happens week 1, how check-ins work, how
   to use the portal, response times.
4. Diet-plan template: calorie + protein targets, vegetarian-first Indian meal
   options, office/travel swaps. Medical conditions → refer to doctor.
5. Check-in process: daily log fields, weekly check-in questions, monthly review.
6. Message templates: welcome, missed check-in nudge, monthly review.

## Open questions (need Pratik)
- Plan tiers, durations and prices?
- Google Form vs extending the site's booking form (recommended: site form,
  since it already syncs to Supabase + Sheets)?
- Exact certification name(s) to show in welcome kit?

## Kickoff prompt
> Work on WS1 (client onboarding). Read the skill file and
> docs/workstreams/ws1-client-onboarding.md in the repo. Start with deliverable 1
> and 2: draft the lead-qualification questions and the intake questionnaire,
> mapped to what the existing booking form and portal already capture. Ask me
> the open questions first.

## Status
Not started.

## Log
- 2026-10-20 — workstream created.
