# WS3 — Website (Vercel)

## Goal
Turn the site into a stable lead-generation and client-service asset: clean
metadata and SEO, refreshed look, deployed on Vercel, Google sign-in, working
client tools.

## Current state (audit 2026-10-20)
- Stack: plain HTML/CSS/vanilla JS, no build step; Supabase (Postgres, Auth,
  Storage); optional Web3Forms + Google Apps Script for Sheets backup.
- Public pages: `index.html`, `pages/` calculator, book, transformations,
  feedback; admin at `pages/admin.html`.
- Client portal: `portal/` (login, signup, dashboard, plan, log, weekly,
  history, files). Schema in `supabase/schema.sql`.
- README describes Netlify deploy; most recent commit deleted `CNAME`
  (custom domain mapping removed).
- **Metadata:** each page has only charset, viewport, `<title>` and (homepage
  only) a meta description. No canonical URLs, Open Graph, Twitter cards,
  JSON-LD, favicon/manifest references or analytics found.
- **Brand mismatch:** site uses "GET FIT WITH PRATIK / GetFitWithPratik";
  Project brand is "Transform with Pratik". Needs a decision before SEO work.
- Design: yellow/black brutalist aesthetic (per README).

## Task list (in order)
1. Decide brand name for the site (blocks titles/SEO).
2. Verify Supabase config in `js/supabase-client.js` uses only the public anon
   key; confirm row-level security policies in `schema.sql` protect client data.
3. Fix calculator page: review formula (Mifflin-St Jeor recommended), inputs,
   activity factors, mobile layout; add protein/macro output.
4. Metadata pass: unique titles/descriptions, canonical, OG/Twitter images,
   JSON-LD (Person + LocalBusiness/ProfessionalService), favicon, `robots.txt`,
   `sitemap.xml`; `noindex` on admin and portal pages.
5. Vercel: import repo, set env/config, custom domain (if any), redirects from
   GitHub Pages.
6. Google sign-in via Supabase Auth (Google provider) on portal login/signup.
7. Look & feel refresh (mobile-first, keep what works).
8. New client tools: e.g. TDEE/macro planner, protein-per-meal planner,
   progress tracker charts in portal, application form.
9. Analytics + promotion: GA4 or privacy-friendly alternative, embed reels and
   YouTube, link-in-bio landing page, basic keyword plan.

## Working rules
- Branch + pull request for every code change; nothing goes live unreviewed.
- Never commit secret keys; only the Supabase anon key may be public.

## Open questions
- Brand name on the site: Transform with Pratik vs GetFitWithPratik?
- Custom domain owned? (CNAME was just deleted.)
- Is the Supabase project live and in use by real clients right now?

## Kickoff prompt
> Work on WS3 (website). Read the skill file and docs/workstreams/ws3-website.md.
> Ask me the 3 open questions, then do tasks 2 and 3 (Supabase safety check and
> calculator fix) on a branch and open a PR.

## Status
Audit done. Next: decisions + tasks 2–3.

## Log
- 2026-10-20 — workstream created; initial audit recorded.
