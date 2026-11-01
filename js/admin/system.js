// Payments overview, site settings, email log and activity log.
import { route, go, store, statusTag, auditText, refreshCounts, q, supa } from './shell.js';
import { $, $$, html, raw, setHTML, fmtNum, fmtDate, fmtDateTime, fmtMoney, timeAgo, toast, busy, ymd, addDays, safeUrl, downloadFile, toCSV } from '../lib/util.js';
import { barChart } from '../lib/charts.js';
import { clearSettingsCache } from '../lib/settings.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

// ------------------------------------------------------------------ Payments
route('payments', async (view) => {
  const today = ymd();
  const since = new Date(); since.setMonth(since.getMonth() - 11); since.setDate(1);
  const [pays, clients] = await Promise.all([
    q(supa.from('payments').select('*, profiles!payments_client_id_fkey(full_name)').gte('paid_on', ymd(since)).order('paid_on', { ascending: false })),
    q(supa.from('profiles').select('id,full_name,plan_name,plan_end,status').eq('role', 'client').in('status', ['active', 'inactive', 'completed']).order('plan_end', { nullsFirst: false })),
  ]);
  const months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)); }
  const byMonth = months.map((m) => ({ x: `${m}-01`, y: pays.filter((p) => p.paid_on.slice(0, 7) === m).reduce((s, p) => s + Number(p.amount), 0) }));
  const active = clients.filter((c) => c.status === 'active');
  const due = active.filter((c) => c.plan_end && c.plan_end <= addDays(today, 30));
  const noEnd = active.filter((c) => !c.plan_end);
  setHTML(view, html`
    <div class="page-intro"><div><h2>Payments and renewals</h2><p>Payments are collected outside the site (UPI or bank transfer) and recorded here.</p></div><button class="btn btn-quiet btn-sm" type="button" data-csv>Export CSV</button></div>
    <div class="panel-grid">
      <section class="panel"><div class="panel-head"><h3>Revenue, last 12 months</h3><span class="small muted">${fmtMoney(pays.reduce((s, p) => s + Number(p.amount), 0))} total</span></div><div data-chart></div></section>
      <section class="panel"><div class="panel-head"><h3>Renewals due in 30 days</h3></div>
        ${due.length ? html`<div class="rows">${due.map((c) => html`<a class="row" href="#client/${c.id}/payments" style="text-decoration:none"><div class="grow"><b>${c.full_name}</b><span>${c.plan_name || 'Plan'} ${c.plan_end < today ? 'ended' : 'ends'} ${fmtDate(c.plan_end)}</span></div>${c.plan_end < today ? statusTag('failed', 'Overdue') : statusTag('pending', `${Math.round((new Date(c.plan_end) - new Date(today)) / 864e5)} days`)}</a>`)}</div>` : html`<p class="muted small">No renewals due.</p>`}
        ${noEnd.length ? html`<p class="small muted" style="margin-top:12px">${noEnd.length} active client${noEnd.length > 1 ? 's have' : ' has'} no plan end date: ${noEnd.slice(0, 5).map((c) => c.full_name).join(', ')}${noEnd.length > 5 ? '...' : ''}. Record a payment with "covers until" to track renewals.</p>` : ''}
        <p class="small muted" style="margin-top:12px">Clients get a reminder email and notification 7 days and 1 day before their plan ends, and you get a copy.</p>
      </section>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Recent payments</h3></div>
      ${pays.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Client</th><th class="num">Amount</th><th>Plan</th><th>Covers until</th><th>Method</th></tr></thead>
      <tbody>${pays.map((p) => html`<tr class="click-row" data-href="client/${p.client_id}/payments" tabindex="0"><td>${fmtDate(p.paid_on)}</td><td>${p.profiles?.full_name || ''}</td><td class="num">${fmtMoney(p.amount, p.currency)}</td><td>${p.plan_name || '-'}</td><td>${p.period_end ? fmtDate(p.period_end) : '-'}</td><td>${p.method || ''}</td></tr>`)}</tbody></table></div>`
    : html`<p class="muted small">No payments recorded yet. Open a client and use the Payments tab.</p>`}
    </section>`);
  barChart($('[data-chart]'), byMonth, { unit: ' INR', label: 'Revenue per month', emptyText: 'No payments recorded in the last 12 months.', xFormat: { month: 'short' } });
  $$('[data-href]').forEach((tr) => tr.addEventListener('click', () => go(tr.dataset.href)));
  $('[data-csv]').addEventListener('click', () => downloadFile(`payments-${today}.csv`, toCSV(pays.map(({ profiles, ...p }) => ({ client: profiles?.full_name, ...p }))), 'text/csv'));
});

// ------------------------------------------------------------------ Settings
route('settings', async (view) => {
  const rows = await q(supa.from('site_settings').select('*'));
  const S = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const contact = S.contact || {}; const coach = S.coach || {}; const plans = S.plans || []; const faq = S.faq || []; const notif = S.notifications || {};
  const isAdmin = store.ctx.profile.role === 'admin';
  const [authCfg, mail] = await Promise.all([
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } }).then((r) => r.json()).catch(() => null),
    fetch(`${SUPABASE_URL}/functions/v1/send-email`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  const ok = (v) => (v ? statusTag('active', 'Working') : statusTag('failed', 'Not set up'));
  setHTML(view, html`
    <div class="page-intro"><div><h2>Site settings</h2><p>Changes appear on the website within a few minutes.</p></div></div>
    <section class="panel"><div class="panel-head"><h3>System status</h3></div>
      <dl class="dl">
        <dt>Database and login</dt><dd>${statusTag('active', 'Working')}</dd>
        <dt>Google sign-in</dt><dd>${ok(authCfg?.external?.google)} ${authCfg?.external?.google ? '' : html`<span class="small muted">Enable the Google provider in Supabase (see SETUP-V3.md).</span>`}</dd>
        <dt>Email confirmation</dt><dd>${authCfg ? (authCfg.mailer_autoconfirm ? html`${statusTag('pending', 'Off')} <span class="small muted">New accounts are not asked to confirm their email.</span>` : statusTag('active', 'On')) : '-'}</dd>
        <dt>Notification emails</dt><dd>${mail?.provider ? html`${statusTag('active', `Working via ${mail.provider}`)}` : html`${statusTag('failed', 'Not set up')} <span class="small muted">Add a Resend or Brevo API key as a Supabase secret. Emails wait in the queue until then.</span>`}</dd>
      </dl>
      <div class="cluster" style="margin-top:14px"><button class="btn btn-ghost btn-sm" type="button" data-test-email>Send a test email to ${contact.email || 'the business email'}</button><a class="btn btn-quiet btn-sm" href="#emails">Email log</a></div>
    </section>
    <form class="panel form" style="margin-top:16px" data-key="contact"><div class="panel-head"><h3>Contact details</h3></div>
      <div class="form-row">
        <div class="field"><label for="s-email">Business email (receives all notifications)</label><input class="input" id="s-email" name="email" type="email" value="${contact.email || ''}"></div>
        <div class="field"><label for="s-wa">WhatsApp number with country code</label><input class="input" id="s-wa" name="whatsapp" value="${contact.whatsapp || ''}" placeholder="+91 98xxxxxxxx"><p class="hint">Shown as WhatsApp buttons across the site when set.</p></div></div>
      <div class="form-row">
        <div class="field"><label for="s-ig">Instagram URL</label><input class="input" id="s-ig" name="instagram" value="${contact.instagram || ''}"></div>
        <div class="field"><label for="s-igh">Instagram handle</label><input class="input" id="s-igh" name="instagram_handle" value="${contact.instagram_handle || ''}"></div>
        <div class="field"><label for="s-yt">YouTube URL</label><input class="input" id="s-yt" name="youtube" value="${contact.youtube || ''}"></div></div>
      <div class="form-row">
        <div class="field"><label for="s-city">City</label><input class="input" id="s-city" name="city" value="${contact.city || ''}"></div>
        <div class="field"><label for="s-rt">Reply time</label><input class="input" id="s-rt" name="response_time" value="${contact.response_time || ''}"></div></div>
      <button class="btn btn-primary btn-sm" type="submit">Save contact details</button></form>
    <form class="panel form" style="margin-top:16px" data-key="coach"><div class="panel-head"><h3>Coach profile</h3></div>
      <div class="form-row"><div class="field"><label for="c-name">Name</label><input class="input" id="c-name" name="name" value="${coach.name || ''}"></div>
        <div class="field"><label for="c-title">Title</label><input class="input" id="c-title" name="title" value="${coach.title || ''}"></div></div>
      <div class="field"><label for="c-photo">Photo ${coach.photo_url ? html`<a class="small" href="${safeUrl(coach.photo_url)}" target="_blank">(current)</a>` : html`<span class="muted small">(none yet: the homepage uses a "How coaching works" card until you add one)</span>`}</label><input class="input" id="c-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"><p class="hint">Portrait, at least 1000 px tall, under 5 MB.</p></div>
      <div class="field"><label for="c-story">Your story (blank line between paragraphs)</label><textarea class="input" id="c-story" name="story" style="min-height:180px">${(coach.story || []).join('\n\n')}</textarea></div>
      <div class="form-row"><div class="field"><label for="c-cred">Credentials, one per line</label><textarea class="input" id="c-cred" name="credentials" placeholder="e.g. ACE Certified Personal Trainer (2025)">${(coach.credentials || []).join('\n')}</textarea><p class="hint">List only what you can show proof of.</p></div>
        <div class="field"><label for="c-stats">Facts shown on About, one per line as Label | Value</label><textarea class="input" id="c-stats" name="stats" placeholder="Clients coached | 25">${(coach.stats || []).map((s) => `${s.label} | ${s.value}`).join('\n')}</textarea><p class="hint">Only real, current numbers.</p></div></div>
      <button class="btn btn-primary btn-sm" type="submit">Save coach profile</button></form>
    <form class="panel form" style="margin-top:16px" data-key="plans"><div class="panel-head"><h3>Coaching plans</h3><button class="btn btn-quiet btn-sm" type="button" data-add-plan>Add plan</button></div>
      <div data-plans></div><button class="btn btn-primary btn-sm" type="submit">Save plans</button></form>
    <form class="panel form" style="margin-top:16px" data-key="faq"><div class="panel-head"><h3>FAQ</h3><button class="btn btn-quiet btn-sm" type="button" data-add-faq>Add question</button></div>
      <div data-faq></div><button class="btn btn-primary btn-sm" type="submit">Save FAQ</button></form>
    <form class="panel form" style="margin-top:16px" data-key="notifications"><div class="panel-head"><h3>Reminders and email copies</h3></div>
      <label class="check"><input type="checkbox" name="reminders_enabled" ${notif.reminders_enabled ? raw('checked') : ''}> <span>Send clients automatic reminders: check-in due (9 am on their check-in day), missed check-in (2 days later) and plan renewal (7 days and 1 day before the end date). Switch on once the new portal is live.</span></label>
      <label class="check"><input type="checkbox" name="copy_coach_on_own_actions" ${notif.copy_coach_on_own_actions !== false ? raw('checked') : ''}> <span>Email me a copy when I approve a client or update a plan</span></label>
      <p class="hint">New enquiries, sign-ups, check-ins, missed check-ins and renewals always email ${contact.email || 'the business email'}.</p>
      <button class="btn btn-primary btn-sm" type="submit">Save</button></form>
    ${isAdmin ? '' : html`<p class="small muted" style="margin-top:12px">Only admins can save settings.</p>`}`);

  let P = structuredClone(plans); let F = structuredClone(faq);
  const readP = () => { P = $$('[data-plan]').map((el) => ({ name: $('[name="p_name"]', el).value.trim(), duration: $('[name="p_duration"]', el).value.trim(), price: $('[name="p_price"]', el).value.trim(), summary: $('[name="p_summary"]', el).value.trim(), features: $('[name="p_features"]', el).value.split('\n').map((x) => x.trim()).filter(Boolean), highlight: $('[name="p_highlight"]', el).checked })).filter((p) => p.name); };
  const drawP = () => setHTML($('[data-plans]'), P.map((p, i) => html`<div class="list-editor-item" data-plan="${i}">
    <div class="form-row"><input class="input" name="p_name" value="${p.name}" placeholder="Plan name" aria-label="Plan name"><input class="input" name="p_duration" value="${p.duration || ''}" placeholder="Duration, e.g. 12 weeks" aria-label="Duration"><input class="input" name="p_price" value="${p.price || ''}" placeholder="Price, e.g. ₹9,999 (leave blank to hide)" aria-label="Price"></div>
    <input class="input" name="p_summary" value="${p.summary || ''}" placeholder="One-line summary" aria-label="Summary">
    <textarea class="input" name="p_features" placeholder="Features, one per line" aria-label="Features" style="min-height:90px">${(p.features || []).join('\n')}</textarea>
    <div class="cluster" style="justify-content:space-between"><label class="check"><input type="checkbox" name="p_highlight" ${p.highlight ? raw('checked') : ''}> Highlight as most chosen</label><button class="btn btn-quiet btn-sm" type="button" data-rm-plan="${i}">Remove</button></div></div>`));
  const readF = () => { F = $$('[data-faqi]').map((el) => ({ q: $('[name="q"]', el).value.trim(), a: $('[name="a"]', el).value.trim() })).filter((f) => f.q && f.a); };
  const drawF = () => setHTML($('[data-faq]'), F.map((f, i) => html`<div class="list-editor-item" data-faqi="${i}"><input class="input" name="q" value="${f.q}" placeholder="Question" aria-label="Question"><textarea class="input" name="a" placeholder="Answer" aria-label="Answer" style="min-height:80px">${f.a}</textarea><button class="btn btn-quiet btn-sm" type="button" data-rm-faq="${i}" style="justify-self:start">Remove</button></div>`));
  drawP(); drawF();
  $('[data-add-plan]').addEventListener('click', () => { readP(); P.push({ name: '', features: [] }); drawP(); });
  $('[data-add-faq]').addEventListener('click', () => { readF(); F.push({ q: '', a: '' }); drawF(); });
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm-plan],[data-rm-faq]'); if (!b) return;
    if (b.dataset.rmPlan) { readP(); P.splice(Number(b.dataset.rmPlan), 1); drawP(); } else { readF(); F.splice(Number(b.dataset.rmFaq), 1); drawF(); }
  });

  const save = async (key, value) => { await q(supa.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString(), updated_by: store.ctx.user.id })); clearSettingsCache(); toast('Saved'); };
  $$('form[data-key]').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form.elements; const key = form.dataset.key;
    busy(form.querySelector('[type="submit"]'), async () => {
      try {
        if (key === 'contact') {
          const v = Object.fromEntries(['email', 'whatsapp', 'instagram', 'instagram_handle', 'youtube', 'city', 'response_time'].map((k) => [k, f[k].value.trim()]));
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) throw new Error('Enter a valid business email.');
          for (const k of ['instagram', 'youtube']) if (v[k] && !/^https:\/\//.test(v[k])) throw new Error(`${k} must be a full https:// link.`);
          await save(key, v);
        } else if (key === 'coach') {
          let photo = coach.photo_url || '';
          const file = f.photo.files[0];
          if (file) {
            if (file.size > 5e6) throw new Error('Photo must be under 5 MB.');
            const path = `coach/${Date.now()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`;
            const { error } = await supa.storage.from('site-media').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
            if (error) throw new Error(error.message);
            photo = `${SUPABASE_URL}/storage/v1/object/public/site-media/${path}`;
          }
          await save(key, {
            name: f.name.value.trim(), title: f.title.value.trim(), photo_url: photo,
            story: f.story.value.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean),
            credentials: f.credentials.value.split('\n').map((x) => x.trim()).filter(Boolean),
            stats: f.stats.value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter(([l, v]) => l && v).map(([label, value]) => ({ label, value })),
          });
        } else if (key === 'plans') { readP(); await save(key, P); }
        else if (key === 'faq') { readF(); await save(key, F); }
        else if (key === 'notifications') await save(key, { reminders_enabled: f.reminders_enabled.checked, copy_coach_on_own_actions: f.copy_coach_on_own_actions.checked });
      } catch (err) { toast(err.message, 'error'); }
    });
  }));
  $('[data-test-email]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const { error } = await supa.rpc('admin_send_test_email');
    if (error) toast(error.message, 'error'); else toast('Queued. Check the inbox in a minute, then the email log.');
  }));
});

// ---------------------------------------------------------------- Email log
route('emails', async (view) => {
  const rows = await q(supa.from('email_outbox').select('*').order('created_at', { ascending: false }).limit(200));
  setHTML(view, html`
    <div class="page-intro"><div><h2>Email log</h2><p>Every notification email the platform has queued or sent.</p></div>
      <div class="cluster"><button class="btn btn-ghost btn-sm" type="button" data-kick>Send queued now</button></div></div>
    ${rows.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Queued</th><th>To</th><th>Subject</th><th>Status</th><th>Details</th><th></th></tr></thead>
    <tbody>${rows.map((r) => html`<tr><td>${timeAgo(r.created_at)}</td><td>${r.to_email}</td><td>${r.subject}<div class="small muted">${r.template}</div></td><td>${statusTag(r.status, r.status)}</td><td class="small">${r.sent_at ? `Sent ${fmtDateTime(r.sent_at)}` : ''}${r.last_error ? html`<span style="color:#F4A08D">${r.last_error}</span>` : ''}${r.attempts > 1 ? ` · ${r.attempts} attempts` : ''}</td>
      <td>${r.status === 'failed' || r.status === 'skipped' ? html`<button class="btn btn-quiet btn-sm" type="button" data-retry="${r.id}">Retry</button>` : ''}</td></tr>`)}</tbody></table></div>`
    : html`<div class="empty"><h3>No emails yet</h3><p>Emails are queued when someone submits an enquiry, signs up, checks in, and so on.</p></div>`}`);
  const kick = () => fetch(`${SUPABASE_URL}/functions/v1/send-email`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json()).catch(() => null);
  $('[data-kick]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const res = await kick();
    toast(res ? `Processed ${res.processed ?? 0} email(s)${res.error ? `: ${res.error}` : ''}` : 'Could not reach the email function.', res && !res.error ? 'ok' : 'error');
    refreshCounts(); go('emails');
  }));
  $$('[data-retry]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    await q(supa.from('email_outbox').update({ status: 'queued', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null, created_at: new Date().toISOString() }).eq('id', b.dataset.retry));
    await kick(); refreshCounts(); go('emails');
  })));
});

// ------------------------------------------------------------ Activity log
route('audit', async (view, table = '') => {
  let query = supa.from('audit_log').select('*').order('at', { ascending: false }).limit(200);
  if (table) query = query.eq('table_name', table);
  const rows = await q(query);
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
  const people = actorIds.length ? await q(supa.from('profiles').select('id,full_name').in('id', actorIds)) : [];
  const names = Object.fromEntries(people.map((p) => [p.id, p.full_name]));
  rows.forEach((r) => { r.actor = { full_name: names[r.actor_id] }; });
  const tables = ['', 'profiles', 'leads', 'plans', 'workout_plans', 'nutrition_plans', 'payments', 'transformations', 'feedback', 'recipes', 'resources', 'site_settings'];
  setHTML(view, html`
    <div class="page-intro"><div><h2>Activity log</h2><p>Who changed what in clients, leads, plans, payments and content.</p></div>
      <select class="input" data-t style="width:auto;min-height:38px" aria-label="Filter">${tables.map((t) => html`<option value="${t}" ${t === table ? raw('selected') : ''}>${t ? t.replace(/_/g, ' ') : 'Everything'}</option>`)}</select></div>
    ${rows.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Changes</th></tr></thead>
    <tbody>${rows.map((r) => html`<tr><td class="nowrap">${fmtDateTime(r.at)}</td><td>${r.actor?.full_name || (r.actor_id ? r.actor_id.slice(0, 8) : 'System')}</td><td>${auditText(r)}</td>
      <td class="small" style="max-width:520px">${r.action === 'update' ? Object.entries(r.changes || {}).slice(0, 6).map(([k, v]) => html`<div><b>${k}</b>: ${short(v.from)} → ${short(v.to)}</div>`) : html`<span class="muted">${Object.keys(r.changes || {}).length} fields</span>`}</td></tr>`)}</tbody></table></div>`
    : html`<div class="empty"><h3>No activity recorded</h3></div>`}`);
  $('[data-t]').addEventListener('change', (e) => go(`audit/${e.target.value}`));
});
const short = (v) => { const s = v == null ? '-' : typeof v === 'object' ? JSON.stringify(v) : String(v); return s.length > 60 ? `${s.slice(0, 57)}...` : s; };
void fmtNum;
