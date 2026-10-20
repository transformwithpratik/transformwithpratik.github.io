# Workstreams

Each workstream runs in its own Claude chat inside the **transformwithpratik** Project.
Shared context lives in `.claude/skills/transform-with-pratik/SKILL.md`; each
workstream's own context, scope and status lives in its file here.

| # | Workstream | File | Status |
|---|---|---|---|
| WS1 | Client onboarding | [ws1-client-onboarding.md](ws1-client-onboarding.md) | Not started |
| WS2 | Reels (Instagram) | [ws2-reels.md](ws2-reels.md) | Not started |
| WS3 | Website (Vercel) | [ws3-website.md](ws3-website.md) | Audit done — next: fixes |
| WS4 | YouTube launch | [ws4-youtube.md](ws4-youtube.md) | Not started |
| WS5 | Trend research & scripts | [ws5-research-scripts.md](ws5-research-scripts.md) | Not started |

## How to start a workstream chat

1. Open a new chat in the **transformwithpratik** Project.
2. Paste the "Kickoff prompt" from the workstream's file.
3. At the end of the session say: **"wrap up"** — Claude updates the workstream
   file's Status and Log, the skill file's status line, memory, and commits.

## Rules shared by all workstreams
- Corrections → memory + skill file + commit (see SKILL.md §0).
- Never invent qualifications, testimonials, results or citations.
- Hand-offs between workstreams go through these files, not chat history
  (e.g. WS5 writes scripts that WS2 schedules).
