# CLAUDE.md

This repo is the website for **Transform with Pratik** (fitness coaching brand).

- Brand context, workstreams and working rules live in
  `.claude/skills/transform-with-pratik/SKILL.md` — read it before any task.
- Whenever Pratik asks for an edit or correction, also update that skill file
  (affected section + Changelog line) in the same commit.
- Inspect existing pages before changing them; the calorie calculator and the
  Supabase client portal (`portal/`, `js/supabase-client.js`) are existing work
  to extend, not replace.
- Never commit secrets (Supabase service keys, OAuth client secrets). Public
  anon keys only, and config via environment variables once on Vercel.
