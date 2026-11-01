# Setup guide (v3: coaching platform)

This replaces SETUP-V2.md. The site is still static files (GitHub Pages) plus Supabase, but
the database, emails and portal were rebuilt. Most of the work is already done on the live
Supabase project; this page lists what is live and the few things only you can switch on.

## What is already live in Supabase

Project `trerqtscrsrlcfsnfetn` (Singapore region).

| Piece | Status |
|---|---|
| Database schema (`supabase/migrations/2026110100*.sql`, 8 files) | Applied. Existing clients, plans, logs, bookings and feedback were kept and migrated. |
| Row level security on every table, private storage buckets, audit log | Applied |
| Content seed (19 recipes, 27 exercises, 26 foods, 10 guides) | Applied. Edit them in the coach dashboard. |
| Edge function `send-email` (transactional email from an outbox table) | Deployed. Sends nothing until you add an email provider key (step 3). |
| Edge function `delete-account` (client self-service deletion) | Deployed |
| Cron `mailer-retry` (every 10 min) | Running. Retries queued emails. |
| Cron `daily-reminders` (09:00 IST) | Running, but **reminders are switched off** in Site settings until you turn them on (step 6). |

Nothing in this repo contains a secret. `js/config.js` holds the public anon key, which is
designed to be public because every table is protected by row level security. The
service-role key only exists inside Supabase's edge function environment.

## 1. Deploy the site

Merge the pull request into `main`. GitHub Pages publishes it in a minute or two.
The old URLs (`/pages/book.html`, `/portal/login.html`, etc.) redirect to the new ones.

## 2. Auth URLs (2 minutes, required)

Supabase dashboard → Authentication → URL Configuration:

- **Site URL:** `https://transformwithpratik.github.io`
- **Redirect URLs:** add
  - `https://transformwithpratik.github.io/portal/`
  - `https://transformwithpratik.github.io/portal/reset/`
  - your Netlify or Vercel domain with the same two paths, if you use one
  - `http://localhost:8080/portal/` for local testing

Without these, confirmation and password-reset links land on the wrong page.

Keep **Confirm email** turned on (Authentication → Providers → Email). New sign-ups are
always created as *pending* clients; you approve them in the dashboard.

## 3. Email

There are two separate kinds of email.

### a) Account emails (confirm sign-up, reset password): Supabase Auth SMTP

Supabase's built-in mailer only delivers to your own team members and is heavily rate
limited, so real clients will not receive confirmation or reset emails until you set custom
SMTP: Authentication → Emails → SMTP Settings. Any of these work:

- **Brevo** (free tier, 300 emails a day): create an account, verify a sender, use its SMTP
  host, port, login and SMTP key.
- **Resend** SMTP: needs a domain you own, verified in Resend.
- **Gmail** with an app password (Google account → Security → App passwords), 500 a day.

For reliable delivery long term, a custom domain (for example `getfitwithpratik.com`) with
SPF/DKIM set up is the best option for both kinds of email.

### b) Notification emails (new lead, check-in submitted, feedback sent, renewals): `send-email` function

Set these secrets in Supabase → Edge Functions → Secrets (or `supabase secrets set NAME=value`):

| Secret | Value |
|---|---|
| `RESEND_API_KEY` **or** `BREVO_API_KEY` | API key from the provider you chose |
| `EMAIL_FROM` | e.g. `GetFitWithPratik <coach@yourdomain.com>` (must be a verified sender/domain) |
| `EMAIL_REPLY_TO` | `transformwithpratik@gmail.com` |
| `SITE_URL` | `https://transformwithpratik.github.io` |

Notes:
- Resend without a verified domain can only send to the email address you signed up to
  Resend with. That is enough for coach alerts, not for client emails.
- Brevo can send from a verified single sender (even a Gmail address), but Gmail-from
  addresses may land in spam; a domain is better.

Then test: coach dashboard → Site settings → System status → **Send a test email**, and
check Email log. Emails queued before the key was added are retried automatically for 48
hours; you can also press Retry in the Email log.

## 4. Google sign-in (optional)

1. Google Cloud Console → APIs & Services → OAuth consent screen: set it up (External,
   app name GetFitWithPratik, your support email).
2. Credentials → Create credentials → OAuth client ID → Web application.
   - Authorized JavaScript origins: `https://transformwithpratik.github.io`
   - Authorized redirect URI: `https://trerqtscrsrlcfsnfetn.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → Google: enable, paste the client ID and client
   secret. The secret stays in Supabase; never put it in this repo.

The "Continue with Google" button appears on the login and register pages automatically once
the provider is enabled. Until then it stays hidden.

## 5. Fill in your details

Coach dashboard (`/admin/`) → Site settings:

- **Contact:** WhatsApp number (digits with country code, e.g. `9198xxxxxxxx`) turns on the
  WhatsApp buttons across the site.
- **Coach:** upload your photo (portrait, under 5 MB), credentials and story.
  Stats are empty on purpose: add only numbers you can stand behind (e.g. clients coached).
  The old site's "200+ clients", "98%" and similar figures were removed because they could
  not be verified.
- **Plans:** add prices when you are ready; plans without a price show "Price on your consult call".
- **FAQ**

Transformations and reviews: add them in the dashboard. A transformation can only be
published after you tick that the client gave written consent; a review only appears after
you approve it and only if the reviewer agreed to it being public.

## 6. Turn on automatic reminders

When your clients are using the new portal: Site settings → Notifications → tick
**Send clients automatic reminders**. Until then, nothing is emailed automatically except
replies to actions (new lead, check-in submitted, feedback sent, plan updated).

## 7. Security settings worth switching on

- Authentication → Password security: minimum length 8 (the forms already require 8) and
  leaked password protection, if your plan includes it.
- Make yourself the only admin. To add a coach, open their client record → Profile → Role
  (only admins can change roles).

## 8. Data retention (your decision)

The privacy notice currently says data is kept while it is useful for coaching and deleted
when a client asks (clients can export their data and delete their account from Profile).
`supabase/optional/retention_job.sql` contains an optional scheduled clean-up (old leads,
old email logs). It is **not** applied. If you want it, read it, adjust the periods, run it
in the SQL editor, and update the privacy page to match.

## Working on the site

```bash
npm run serve            # http://localhost:8080
npm test                 # calculator maths
node tests/e2e/run.mjs   # browser tests (Playwright + Chromium; uses a fake Supabase)
npm run build            # regenerate recipe pages (from the live recipes), guides, portal pages, header/footer
npm run build:offline    # same, using the recipe source files instead of the database
```

- Header, footer and `<head>` are shared partials (`partials/`). Edit them there, then run
  `node scripts/sync-partials.mjs`.
- Recipes you add in the dashboard work straight away at `/nutrition/recipe/?slug=...`.
  Run `npm run build` and commit to also get a pre-rendered, search-friendly page for them.
- Database changes go in a new file in `supabase/migrations/`; never edit an applied one.
  `supabase/schema.sql` is the old v2 schema, kept for history only.
- Moving to Vercel later: `vercel.json` already has the clean URLs and redirects. Nothing
  needs environment variables today; if you add server code, keep secrets in Vercel's
  environment settings, never in the repo.
