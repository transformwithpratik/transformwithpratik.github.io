# GetFitWithPratik 🔥

A complete fitness coaching website + client portal for **Pratik** (Bengaluru).
Yellow/black brutalist aesthetic, no frameworks, deploys anywhere static.

## Architecture

```
🌐 Public site (marketing)
   ├── Homepage, transformations, calorie calculator
   ├── Booking form  → 3-way sync: Supabase + Email + Google Sheets
   └── Feedback form → 3-way sync: Supabase + Email + Google Sheets

🔐 Client Portal (/portal/*)
   ├── Sign up / Sign in           (Supabase Auth)
   ├── Dashboard                   (plan targets + today's status)
   ├── Daily Log                   (macros, steps, workout, custom fields)
   ├── Weekly Check-in             (weight + 3 progress photos)
   ├── Plan Viewer                 (read-only + PDF download)
   ├── Files                       (PDFs pushed by admin)
   └── History                     (full log history with filters)

🛠️  Admin Dashboard (/pages/admin.html)
   ├── Overview stats
   ├── Clients list                (sign up via portal, you assign plans)
   ├── Client Detail page:
   │   ├── Plan editor (macros, workout, diet, supplements, custom fields)
   │   ├── Daily logs viewer
   │   ├── Weekly check-ins viewer
   │   ├── Photo gallery (all progress photos)
   │   ├── Files pusher (upload PDFs to this client)
   │   └── Export All as CSV
   ├── Bookings & Feedback         (with CSV export)
   ├── Transformations             (homepage gallery)
   ├── Testimonials                (homepage quotes)
   ├── Schedule                    (availability hours)
   └── Socials                     (IG, YT, WhatsApp links)
```

## Tech Stack

- **Frontend:** Pure HTML/CSS/Vanilla JS — no build step, no framework
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Hosting:** Any static host — Netlify recommended
- **Optional:** Web3Forms (email alerts) + Google Apps Script (Sheets backup)

## Quick Start

**👉 Follow [SETUP-V2.md](./SETUP-V2.md) for the complete setup walkthrough.**

Short version:
1. Create a free Supabase project, run `supabase/schema.sql` in SQL Editor
2. Paste your Supabase URL + anon key into `js/supabase-client.js`
3. Sign up at `/portal/signup.html`, then promote yourself to admin via Supabase Table Editor
4. Deploy by drag-dropping the folder onto **app.netlify.com/drop**

## File Structure

```
getfitwithpratik/
├── index.html                  # Homepage
├── README.md                   # This file
├── SETUP-V2.md                 # Full setup guide (start here!)
├── SETUP.md                    # Legacy v1 setup (Web3Forms only)
│
├── css/
│   ├── style.css               # Main theme (yellow/black brutalist)
│   └── portal.css              # Portal-specific styles
│
├── js/
│   ├── main.js                 # Public site interactivity
│   ├── supabase-client.js      # Supabase wrapper (CONFIG goes here)
│   └── portal.js               # Portal shared logic (sidebar, auth)
│
├── pages/
│   ├── book.html               # Booking form
│   ├── calculator.html         # Calorie/macro calculator
│   ├── feedback.html           # Feedback form
│   ├── transformations.html    # Public gallery
│   ├── admin-login.html        # Legacy admin login (still works)
│   └── admin.html              # Admin dashboard (Supabase-backed)
│
├── portal/                     # Client portal
│   ├── login.html
│   ├── signup.html
│   ├── dashboard.html
│   ├── log.html                # Daily logging
│   ├── weekly.html             # Weight + photos
│   ├── plan.html               # Plan viewer
│   ├── files.html              # PDF downloads
│   └── history.html            # Full log history
│
├── supabase/
│   └── schema.sql              # Run this in Supabase SQL Editor
│
└── assets/                     # Images, etc.
```

## Common Tasks

### Onboard a new client
1. Client pays you offline
2. You share: `yoursite.com/portal/signup.html`
3. Client signs up
4. You log in → Clients tab → **Manage** that client → fill in plan → Save

### Export a client's complete history as CSV
Admin → Clients → **Manage** → **Export All as CSV** button (top right)

### Add a custom logging field for a specific client
(e.g. "Water intake" for a hydration-focused client)
Admin → Clients → **Manage** → Scroll to "Custom Logging Fields" → **+ Add Custom Field**

### Push a PDF to a client
Admin → Clients → **Manage** → **Files** tab → fill title + description + upload

### Edit homepage transformations / testimonials
Admin → Transformations or Testimonials tab → add/delete from there

## Free Tier Capacity

Comfortable for **50–100 active clients** before any paid tier is needed.
See SETUP-V2.md "Free Tier Limits" section for exact numbers.

## Support

Most issues are config typos. Open browser DevTools (F12) → Console — Supabase errors are usually clear about what's wrong.

---

**Built for Pratik · `letsgetfitwithpratik@gmail.com` · 2026**
