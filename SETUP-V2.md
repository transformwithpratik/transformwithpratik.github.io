# GetFitWithPratik — Full Setup Guide (v2)

This is the **client portal version**. It replaces V1 entirely.
Follow these steps in order. **Total time: ~30 minutes.**

---

## What you're setting up

Your website now has:
- 🌐 **Public marketing site** (already done) — homepage, booking, calculator, feedback
- 🔐 **Client Portal** — each paying client logs in to see their plan and log daily progress
- 🛠️ **Admin Dashboard** — you create plans, view logs, push PDFs, see photos
- 📤 **Triple data backup** — Supabase (primary) + Google Sheets + Email (Web3Forms)

You need 3 free accounts (you may already have some):
1. **Supabase** (database + auth + file storage) — required
2. **Web3Forms** (email notifications) — optional but recommended
3. **Google account** (Sheets backup) — optional but recommended

---

## STEP 1: Create Your Supabase Project (10 min)

### 1.1 — Sign up
1. Go to **https://supabase.com** → "Start your project"
2. Sign in with GitHub (easiest) or email
3. Click **"New Project"**

### 1.2 — Configure the project
- **Name:** `getfitwithpratik`
- **Database Password:** Generate a strong one and **save it** (you won't normally need it, but keep it safe)
- **Region:** Pick the closest to India — **Mumbai (ap-south-1)** is best
- **Pricing Plan:** Free
- Click **"Create new project"** — wait ~2 minutes for it to provision

### 1.3 — Run the database schema
Once the project is ready:

1. In the left sidebar, click **SQL Editor**
2. Click **"+ New query"**
3. Open the file `supabase/schema.sql` from your website folder
4. **Copy the ENTIRE contents** and paste into the SQL editor
5. Click **"Run"** (bottom-right)
6. You should see "Success. No rows returned." — that's perfect.

### 1.4 — Verify storage buckets
1. Left sidebar → **Storage**
2. You should see 3 buckets: `client-photos`, `client-plans`, `transformations`
3. If any are missing, click "New bucket" and create them:
   - `client-photos` — Private
   - `client-plans` — Private
   - `transformations` — Public

### 1.5 — Get your API keys
1. Left sidebar → **Settings (gear icon)** → **API**
2. Copy these two values (keep this tab open):
   - **Project URL** — e.g. `https://abcdefgh.supabase.co`
   - **anon public key** — long string starting with `eyJh...`

> ⚠️ The "anon key" is safe to put in your website code. The "service_role" key is NOT — never use it in the frontend.

### 1.6 — Disable email confirmation (optional but recommended for now)
While clients are signing up directly with you, you might want to skip the confirmation step:

1. Left sidebar → **Authentication** → **Providers** → **Email**
2. Toggle OFF **"Confirm email"**
3. Save

(You can turn this back on later when you're getting random signups.)

---

## STEP 2: Add Keys to Your Website (2 min)

1. Open `js/supabase-client.js` in any text editor
2. Find the `SUPABASE_CONFIG` block near the top:

```js
const SUPABASE_CONFIG = {
  url: '',         // ← paste Project URL here
  anonKey: '',     // ← paste anon public key here
  web3formsKey: '',
  googleSheetsUrl: '',
  adminEmail: 'letsgetfitwithpratik@gmail.com'
};
```

3. Paste your Supabase URL and anon key into the first two fields
4. **Save** the file

> If you skipped Web3Forms/Sheets setup, that's fine — leave those empty. The portal still works.

---

## STEP 3: Make Yourself the Admin (3 min)

The portal currently has zero users. You need to create yourself an admin account.

### 3.1 — Create your account
1. Open your website locally (or after deploying — see Step 6)
2. Go to `/portal/signup.html`
3. Sign up with:
   - **Email:** `letsgetfitwithpratik@gmail.com` (or any email you'll use to admin)
   - A strong password
   - Your name and phone

### 3.2 — Promote yourself to admin
Back in Supabase:

1. Left sidebar → **Table Editor** → **profiles** table
2. Find the row with your email
3. Click on the **role** column → change `client` to `admin` → Save

That's it. Now when you log in via `/portal/login.html`, you'll be redirected to the admin panel.

---

## STEP 4: (Optional) Web3Forms Email Setup (5 min)

This lets you get an email whenever someone books a session or submits feedback.

1. Go to **https://web3forms.com**
2. Enter `letsgetfitwithpratik@gmail.com` → Click **"Create Access Key"**
3. **Check your email** — you'll get a 36-character key (looks like `a1b2c3d4-...`)
4. Copy that key
5. Open `js/supabase-client.js` and paste it into `web3formsKey`:

```js
web3formsKey: 'your-key-here',
```

---

## STEP 5: (Optional) Google Sheets Backup (10 min)

This appends every booking/feedback to a Google Sheet — useful as a familiar interface for you.

### 5.1 — Create the Sheet
1. Go to **https://sheets.google.com** → Create a new sheet
2. Name it: `GetFitWithPratik Submissions`
3. Create two tabs: `Bookings` and `Feedback`
4. Add header rows to each:

**Bookings tab — row 1:**
`Timestamp | Name | Email | Phone | Age | Weight | Goal | Experience | Location | Plan | Message`

**Feedback tab — row 1:**
`Timestamp | Name | Email | Rating | Relationship | Feedback | Can Share?`

### 5.2 — Add the Apps Script
1. In your sheet → **Extensions** → **Apps Script**
2. Delete the default code, paste in:

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const tab = sheet.getSheetByName(data.type === 'bookings' ? 'Bookings' : 'Feedback');

  const row = data.type === 'bookings'
    ? [data.timestamp, data.data.name, data.data.email, data.data.phone, data.data.age, data.data.weight, data.data.goal, data.data.experience, data.data.location, data.data.plan, data.data.message]
    : [data.timestamp, data.data.name, data.data.email, data.data.rating, data.data.relationship, data.data.feedback, Array.isArray(data.data.can_share) ? data.data.can_share.join(', ') : data.data.can_share];

  tab.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
}
```

3. Click **Deploy** → **New deployment**
4. Click the gear icon → choose **Web app**
5. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
6. Click **Deploy**
7. Authorize when prompted
8. **Copy the Web app URL**
9. Open `js/supabase-client.js` and paste into `googleSheetsUrl`:

```js
googleSheetsUrl: 'https://script.google.com/macros/s/.../exec',
```

---

## STEP 6: Deploy Your Site (Netlify — free, 3 min)

The easiest way to get your site live:

1. Go to **https://app.netlify.com/drop**
2. Drag the **entire `getfitwithpratik` folder** onto the page
3. Wait ~30 seconds → you get a free URL like `random-name.netlify.app`
4. (Later) Connect your domain `getfitwithpratik.com`:
   - Netlify → Site settings → Domain management → Add custom domain
   - Follow their DNS instructions

---

## STEP 7: Onboard Your First Client (2 min)

Once everything's deployed, the flow is:

1. Client pays you (offline / UPI / however)
2. You send them: `https://yoursite.com/portal/signup.html`
3. They sign up — name, phone, email, password
4. **You** log into `/portal/login.html` (you'll go to admin)
5. Click **Clients** tab → find the new signup → **Manage →**
6. Fill in their plan: macros, workout split, diet, supplements, custom log fields
7. Optionally upload their plan PDF
8. **Save Plan**
9. Tell client to log in and start tracking

They will now:
- Log daily food, training, steps from `/portal/log.html`
- Submit weekly weight + 3 progress photos from `/portal/weekly.html`
- Download any PDFs you push from `/portal/files.html`

You will:
- See all logs in real-time under their profile in the admin
- Export their full history as CSV anytime
- Push new files, update their plan, add custom fields

---

## Troubleshooting

**"Portal not configured" message**
→ You haven't added your Supabase URL/key to `js/supabase-client.js`. Re-check Step 2.

**Client gets "Email not confirmed" error**
→ Either turn off email confirmation (Step 1.6) or have them check their inbox for the confirmation link.

**Photos not uploading**
→ Check Supabase Storage → `client-photos` bucket exists. If not, create it manually as Private.

**Admin login redirects to client dashboard**
→ Your account's `role` is still `client` in the profiles table. Change it to `admin` (Step 3.2).

**Plans not saving**
→ Open browser DevTools (F12) → Console tab. Check for red errors. Most likely Supabase URL/key typo.

---

## Free Tier Limits (you'll be fine for a while)

- **Supabase Free:** 500 MB database, 1 GB storage, 50k monthly auth users, 5 GB bandwidth
- **Web3Forms Free:** 250 submissions/month
- **Google Sheets:** essentially unlimited for this use
- **Netlify Free:** 100 GB bandwidth/month

For a coaching business, this comfortably handles 50–100 active clients before you'd need to upgrade.

---

## Need help?

Send the exact error message + which step you're on. The most common issues are typos in the URL/anon key or forgetting to promote your account to admin.
