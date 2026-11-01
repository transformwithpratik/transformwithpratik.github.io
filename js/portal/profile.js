import { mountPortal } from '../lib/portal.js';
import { supa, q } from '../lib/supabase.js';
import { signOut } from '../lib/auth.js';
import { $, html, raw, setHTML, fmtDate, fmtMoney, label, LABELS, numOrNull, toast, showErrors, formToObject, busy, downloadFile, ymd } from '../lib/util.js';
import { weekdayName } from './data.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const ctx = await mountPortal({ active: 'profile', title: 'Profile' });
if (ctx) render(ctx).catch((err) => setHTML(ctx.content, html`<div class="notice danger">Could not load your profile. ${err.message}</div>`));

async function render({ user, profile: p, content }) {
  const payments = await q(supa.from('payments').select('*').eq('client_id', user.id).order('paid_on', { ascending: false }));
  const sel = (name, options, cur, blank = 'Choose') => html`<select class="input" id="pf-${name}" name="${name}"><option value="">${blank}</option>${Object.entries(options).map(([k, v]) => html`<option value="${k}" ${String(cur ?? '') === String(k) ? raw('selected') : ''}>${v}</option>`)}</select>`;
  const google = (user.app_metadata?.providers || []).includes('google');

  setHTML(content, html`
    <div class="page-intro"><div><h2>Profile</h2><p>${user.email}</p></div><span class="tag tag-lime">${label('status', p.status)}</span></div>
    <div class="panel-grid">
      <section class="panel"><div class="panel-head"><h3>Your details</h3></div>
        <form class="form" id="pf" novalidate>
          <div class="form-row">
            <div class="field"><label for="pf-full_name">Full name</label><input class="input" id="pf-full_name" name="full_name" maxlength="100" value="${p.full_name || ''}" required><p class="field-error" data-error-for="full_name" id="pe1"></p></div>
            <div class="field"><label for="pf-phone">WhatsApp number</label><input class="input" id="pf-phone" name="phone" type="tel" maxlength="20" value="${p.phone || ''}"></div>
          </div>
          <div class="form-row">
            <div class="field"><label for="pf-sex">Sex</label>${sel('sex', { male: 'Male', female: 'Female', other: 'Other' }, p.sex)}</div>
            <div class="field"><label for="pf-dob">Date of birth</label><input class="input" id="pf-dob" name="date_of_birth" type="date" max="${ymd()}" value="${p.date_of_birth || ''}"></div>
            <div class="field"><label for="pf-city">City</label><input class="input" id="pf-city" name="city" maxlength="80" value="${p.city || ''}"></div>
          </div>
          <div class="form-row">
            <div class="field"><label for="pf-h">Height</label><div class="input-group"><input class="input" id="pf-h" name="height_cm" type="number" inputmode="decimal" min="100" max="250" value="${p.height_cm ?? ''}"><span class="suffix">cm</span></div><p class="field-error" data-error-for="height_cm" id="pe2"></p></div>
            <div class="field"><label for="pf-sw">Starting weight</label><div class="input-group"><input class="input" id="pf-sw" name="start_weight" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${p.start_weight ?? ''}"><span class="suffix">kg</span></div><p class="field-error" data-error-for="start_weight" id="pe3"></p></div>
            <div class="field"><label for="pf-tw">Target weight</label><div class="input-group"><input class="input" id="pf-tw" name="target_weight" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${p.target_weight ?? ''}"><span class="suffix">kg</span></div><p class="field-error" data-error-for="target_weight" id="pe4"></p></div>
          </div>
          <div class="form-row">
            <div class="field"><label for="pf-goal">Main goal</label>${sel('goal', LABELS.goal, p.goal)}</div>
            <div class="field"><label for="pf-diet_preference">Food preference</label>${sel('diet_preference', { vegetarian: 'Vegetarian', eggetarian: 'Eggetarian', non_vegetarian: 'Non-vegetarian', vegan: 'Vegan', jain: 'Jain' }, p.diet_preference)}</div>
            <div class="field"><label for="pf-checkin_day">Check-in day</label>${sel('checkin_day', Object.fromEntries([1, 2, 3, 4, 5, 6, 0].map((d) => [d, weekdayName(d)])), p.checkin_day, 'Choose')}</div>
          </div>
          <p class="field-error" data-error-for="form" role="alert" id="pe5"></p>
          <button class="btn btn-primary" type="submit">Save details</button>
        </form>
      </section>
      <div class="stack" style="--stack:16px">
        <section class="panel"><div class="panel-head"><h3>Coaching</h3></div>
          <dl class="dl">
            <dt>Status</dt><dd>${label('status', p.status)}</dd>
            <dt>Plan</dt><dd>${p.plan_name || '-'}</dd>
            <dt>Started</dt><dd>${p.plan_start ? fmtDate(p.plan_start) : p.approved_at ? fmtDate(p.approved_at) : '-'}</dd>
            <dt>Ends</dt><dd>${p.plan_end ? fmtDate(p.plan_end) : '-'}</dd>
          </dl>
          ${payments.length ? html`<h4 style="margin:18px 0 8px;font-size:1rem">Payments</h4><div class="rows">${payments.map((x) => html`<div class="row"><div class="grow"><b>${fmtMoney(x.amount, x.currency)}</b><span>${fmtDate(x.paid_on)}${x.plan_name ? ` · ${x.plan_name}` : ''}${x.period_end ? ` · until ${fmtDate(x.period_end)}` : ''}</span></div></div>`)}</div>` : ''}
        </section>
        <section class="panel"><div class="panel-head"><h3>Notifications</h3></div>
          <label class="check"><input type="checkbox" data-emails ${p.email_notifications ? raw('checked') : ''}> <span>Email me about plan updates, coach feedback, check-in reminders and renewals</span></label>
          <p class="hint" style="margin-top:8px">In-portal notifications are always on. Account emails like password resets are always sent.</p>
        </section>
      </div>
    </div>
    <div class="panel-grid even" style="margin-top:16px">
      <section class="panel"><div class="panel-head"><h3>Login and security</h3></div>
        ${google ? html`<p class="small muted">You sign in with Google. You can also set a password below to log in with your email.</p>` : ''}
        <form class="form" id="pw" novalidate>
          <div class="form-row">
            <div class="field"><label for="pw1">New password</label><input class="input" id="pw1" name="password" type="password" autocomplete="new-password" minlength="8"><p class="field-error" data-error-for="password" id="pwe1"></p></div>
            <div class="field"><label for="pw2">Confirm</label><input class="input" id="pw2" name="password2" type="password" autocomplete="new-password"><p class="field-error" data-error-for="password2" id="pwe2"></p></div>
          </div>
          <p class="field-error" data-error-for="form" role="alert" id="pwe3"></p>
          <button class="btn btn-ghost btn-sm" type="submit">Change password</button>
        </form>
        <hr>
        <form class="form" id="em" novalidate>
          <div class="field"><label for="em1">Change email</label><input class="input" id="em1" name="email" type="email" value="${user.email}"><p class="hint">We send a confirmation link to the new address. Your email stays the same until you click it.</p><p class="field-error" data-error-for="email" id="eme1"></p></div>
          <p class="field-error" data-error-for="form" role="alert" id="eme2"></p>
          <button class="btn btn-ghost btn-sm" type="submit">Update email</button>
        </form>
        <hr>
        <button class="btn btn-quiet btn-sm" type="button" data-signout>Sign out</button>
      </section>
      <section class="panel"><div class="panel-head"><h3>Your data</h3></div>
        <p class="small muted">Download everything stored about you: profile, plans, food and workout logs, measurements, check-ins, feedback and payment records. Photos are listed with download links valid for 24 hours.</p>
        <button class="btn btn-ghost btn-sm" type="button" data-export>Export my data</button>
        <hr>
        <h4 style="font-size:1rem">Delete account</h4>
        <p class="small muted">Permanently deletes your account, logs, check-ins, photos, plans and payment records. This cannot be undone.</p>
        <button class="btn btn-danger btn-sm" type="button" data-delete>Delete my account</button>
      </section>
    </div>`);

  $('[data-signout]').addEventListener('click', signOut);

  const pf = $('#pf');
  pf.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formToObject(pf);
    const row = {
      full_name: d.full_name, phone: d.phone || null, sex: d.sex || null, date_of_birth: d.date_of_birth || null, city: d.city || null,
      height_cm: numOrNull(d.height_cm), start_weight: numOrNull(d.start_weight), target_weight: numOrNull(d.target_weight),
      goal: d.goal || null, diet_preference: d.diet_preference || null, checkin_day: d.checkin_day === '' ? p.checkin_day : Number(d.checkin_day),
    };
    const errs = {};
    if (!row.full_name || row.full_name.length < 2) errs.full_name = 'Enter your name.';
    if (row.height_cm != null && (row.height_cm < 100 || row.height_cm > 250)) errs.height_cm = 'Height must be between 100 and 250 cm.';
    for (const k of ['start_weight', 'target_weight']) if (row[k] != null && (row[k] < 30 || row[k] > 300)) errs[k] = 'Must be between 30 and 300 kg.';
    if (!showErrors(pf, errs)) return;
    busy(pf.querySelector('[type="submit"]'), async () => {
      try { await q(supa.from('profiles').update(row).eq('id', user.id)); Object.assign(p, row); toast('Details saved'); } catch (err) { showErrors(pf, { form: err.message }); }
    });
  });

  $('[data-emails]').addEventListener('change', async (e) => {
    try { await q(supa.from('profiles').update({ email_notifications: e.target.checked }).eq('id', user.id)); toast(e.target.checked ? 'Emails turned on' : 'Emails turned off'); } catch (err) { toast(err.message, 'error'); e.target.checked = !e.target.checked; }
  });

  const pw = $('#pw');
  pw.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formToObject(pw);
    const errs = {};
    if ((d.password || '').length < 8) errs.password = 'Use at least 8 characters.';
    if (d.password !== d.password2) errs.password2 = 'Passwords do not match.';
    if (!showErrors(pw, errs)) return;
    busy(pw.querySelector('[type="submit"]'), async () => {
      const { error } = await supa.auth.updateUser({ password: d.password });
      if (error) { showErrors(pw, { form: /reauth|recent/i.test(error.message) ? 'For security, log out and use "Forgot password" to set a new one.' : error.message }); return; }
      pw.reset(); toast('Password changed');
    });
  });

  const em = $('#em');
  em.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = em.elements.email.value.trim();
    if (!showErrors(em, /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? {} : { email: 'Enter a valid email.' })) return;
    if (email.toLowerCase() === user.email.toLowerCase()) { toast('That is already your email.'); return; }
    busy(em.querySelector('[type="submit"]'), async () => {
      const { error } = await supa.auth.updateUser({ email }, { emailRedirectTo: `${location.origin}/portal/profile/` });
      if (error) { showErrors(em, { form: error.message }); return; }
      toast('Check both inboxes to confirm the change.');
    });
  });

  $('[data-export]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const tables = ['plans', 'workout_plans', 'nutrition_plans', 'daily_logs', 'food_logs', 'saved_foods', 'workout_logs', 'progress_records', 'progress_photos', 'weekly_checkins', 'weekly_logs', 'coach_feedback', 'payments', 'favorites', 'notifications', 'client_files'];
    const out = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at }, profile: p };
    for (const t of tables) {
      const col = t === 'notifications' ? 'user_id' : 'client_id';
      const { data } = await supa.from(t).select('*').eq(col, user.id);
      out[t] = data || [];
    }
    if (out.progress_photos.length) {
      const { data } = await supa.storage.from('client-photos').createSignedUrls(out.progress_photos.map((x) => x.path), 86400);
      const map = Object.fromEntries((data || []).map((d) => [d.path, d.signedUrl]));
      out.progress_photos = out.progress_photos.map((x) => ({ ...x, download_url_24h: map[x.path] || null }));
    }
    downloadFile(`getfitwithpratik-data-${ymd()}.json`, JSON.stringify(out, null, 2), 'application/json');
    toast('Export downloaded');
  }));

  $('[data-delete]').addEventListener('click', () => {
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.innerHTML = String(html`<form method="dialog"><div class="modal-head"><h2>Delete your account?</h2></div>
      <div class="modal-body form"><p>This permanently removes your account and all your coaching data, including photos. Consider exporting your data first.</p>
      <div class="field"><label for="del-confirm">Type DELETE to confirm</label><input class="input" id="del-confirm" autocomplete="off"></div>
      <p class="field-error" data-err role="alert"></p></div>
      <div class="modal-foot"><button class="btn btn-ghost btn-sm" value="cancel">Cancel</button><button class="btn btn-danger btn-sm" type="button" data-go>Delete permanently</button></div></form>`);
    $('.app').appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.showModal();
    d.querySelector('[data-go]').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
      if (d.querySelector('#del-confirm').value.trim() !== 'DELETE') { d.querySelector('[data-err]').textContent = 'Type DELETE in capitals to confirm.'; return; }
      const { data: s } = await supa.auth.getSession();
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.session.access_token}` },
          body: JSON.stringify({ confirm: 'DELETE' }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
        await supa.auth.signOut();
        location.replace('/?account=deleted');
      } catch (err) {
        d.querySelector('[data-err]').textContent = `${err.message}. If this keeps happening, email transformwithpratik@gmail.com and your data will be deleted manually.`;
      }
    }));
  });
}
