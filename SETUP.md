# SETUP — Connect Email & Database

This guide walks you through 4 things, takes about 10 minutes total, and you only do it once.

When you're done:
- ✅ Every booking → email to **letsgetfitwithpratik@gmail.com**
- ✅ Every feedback → email to **letsgetfitwithpratik@gmail.com**
- ✅ Every submission → row in your Google Sheet (your "database")
- ✅ Admin dashboard still works as a backup view

---

## Step 1 — Get a free Web3Forms key (2 min)

This is what sends the emails. No account signup required.

1. Open **https://web3forms.com**
2. Scroll to "Create your access key"
3. Type in your email: `letsgetfitwithpratik@gmail.com`
4. Click "Create Access Key"
5. Check your Gmail inbox — Web3Forms will send you a key like `abc123de-4567-89fg-hijk-lmnopqrstuv`
6. **Copy that key** — you'll paste it in Step 4

---

## Step 2 — Create your Google Sheet (2 min)

This is your "database" — every form submission becomes a row.

1. Go to **https://sheets.google.com** and click **Blank**
2. Name it something like `GetFitWithPratik Submissions`
3. In the first row, add these column headers (one per column):
   ```
   Timestamp | Type | Name | Email | Phone | Goal | Plan | Message | Rating | Feedback | Raw Data
   ```
4. **Keep this sheet open** — you'll need it for Step 3

---

## Step 3 — Create the Apps Script (4 min)

This is the bridge between your website and the sheet.

1. In your Google Sheet, click **Extensions → Apps Script**
2. Delete whatever code is there
3. Paste this code exactly:

   ```javascript
   function doPost(e) {
     try {
       const sheet = SpreadsheetApp.getActiveSheet();
       const body = JSON.parse(e.postData.contents);
       const d = body.data || {};

       sheet.appendRow([
         body.timestamp || new Date().toISOString(),
         body.type || '',
         d.name || '',
         d.email || '',
         d.phone || '',
         d.goal || '',
         d.plan || '',
         d.message || '',
         d.rating || '',
         d.feedback || '',
         JSON.stringify(d)
       ]);

       return ContentService.createTextOutput(JSON.stringify({ ok: true }))
         .setMimeType(ContentService.MimeType.JSON);
     } catch (err) {
       return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
         .setMimeType(ContentService.MimeType.JSON);
     }
   }
   ```

4. Click the **Save** icon (💾) at the top
5. Click **Deploy → New deployment**
6. Click the gear icon next to "Select type" → choose **Web app**
7. Fill out:
   - **Description**: `GFP form receiver`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone` ← important
8. Click **Deploy**
9. Google asks for permission — click **Authorize access** → pick your Google account → click **Advanced** → **Go to (project name) (unsafe)** → **Allow**. (This warning is normal for personal scripts; you're authorizing your own script to write to your own sheet.)
10. You'll see a **Web app URL** — looks like `https://script.google.com/macros/s/AKfy.../exec`
11. **Copy that URL** — you'll paste it in Step 4

---

## Step 4 — Plug both into your site (1 min)

1. Open the file `js/main.js` in any text editor
2. Find this block at the very top:
   ```javascript
   const CONFIG = {
     WEB3FORMS_KEY: '',
     ADMIN_EMAIL: 'letsgetfitwithpratik@gmail.com',
     GOOGLE_SHEETS_URL: ''
   };
   ```
3. Paste your two values inside the empty quotes:
   ```javascript
   const CONFIG = {
     WEB3FORMS_KEY: 'abc123de-4567-89fg-hijk-lmnopqrstuv',
     ADMIN_EMAIL: 'letsgetfitwithpratik@gmail.com',
     GOOGLE_SHEETS_URL: 'https://script.google.com/macros/s/AKfy.../exec'
   };
   ```
4. Save the file
5. Re-deploy to Netlify (just drag the folder onto Netlify Drop again, or push if you're on Git)

---

## Test it works

1. Open your live site
2. Go to **Book a Session**, fill out the form, submit
3. Within ~30 seconds you should see:
   - 📧 Email at `letsgetfitwithpratik@gmail.com`
   - 📊 New row in your Google Sheet
   - 💾 Booking visible in `/pages/admin.html`

If any of those don't happen, open your browser console (F12) — any errors will be logged there.

---

## Where do client photos go?

Photos are pasted into the **Admin → Transformations** tab as URLs. Here's the workflow:

1. Sign in to admin (`/pages/admin-login.html`)
2. Click the **Transformations** tab
3. Follow the on-screen instructions: upload to **imgur.com/upload** (no account needed), copy the image URL, paste it in
4. The admin shows a live preview so you know the URL works
5. Hit "Add" — image is now live on your site

Same flow for testimonials (Admin → Testimonials), but no image needed — just text.

---

## If you outgrow this setup

When you have 100+ clients and want a proper backend with image uploads, login system for clients, etc. — let me know and I'll migrate you to **Supabase**. It's still free up to 500MB and gives you real database queries, file uploads, and per-client logins. The current setup is intentionally simple so you don't pay for or maintain anything you don't need yet.

---

## Help! Something broke

Common issues:

- **No emails arriving**: Check spam folder. Then double-check the Web3Forms key in `js/main.js` matches the one from your email.
- **Sheet not updating**: Re-deploy your Apps Script (Deploy → Manage Deployments → pencil icon → Version: New version → Deploy). Apps Script needs a redeploy if you ever change the code.
- **Admin dashboard says "setup incomplete"**: That means one of the two CONFIG values is still empty. Open `js/main.js` and check.
- **Form submits but says "Sending..." forever**: Open browser console (F12). The error will tell you which integration failed.
