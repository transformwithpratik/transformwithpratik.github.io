import { route, go, rowLinks, statusTag, refreshCounts, store, q, supa } from './shell.js';
import { $, $$, html, raw, setHTML, fmtNum, fmtDate, fmtDateTime, fmtMoney, timeAgo, label, LABELS, waLink, toast, confirmDialog, busy, debounce, downloadFile, toCSV, ymd, addDays, numOrNull, initTabs } from '../lib/util.js';
import { openModal } from '../lib/portal.js';
import { signedUrls } from '../lib/supabase.js';
import { lineChart } from '../lib/charts.js';
import { movingAverage, sumMacros } from '../lib/calc.js';
import { getSettings } from '../lib/settings.js';
import { renderPlanTab } from './planbuilder.js';
import { weekdayName } from '../portal/data.js';
import { checkinCard } from './checkins.js';

const STATUS_ORDER = ['pending', 'active', 'inactive', 'completed', 'rejected'];

route('clients', async (view, filter = '') => {
  const [rows, invites] = await Promise.all([
    q(supa.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false })),
    q(supa.from('client_invites').select('*').is('used_at', null).order('created_at', { ascending: false })),
  ]);
  const state = { status: filter || (rows.some((r) => r.status === 'pending') ? 'pending' : 'active'), term: '' };
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, rows.filter((r) => r.status === s).length]));
  setHTML(view, html`
    <div class="page-intro"><div><h2>Clients</h2><p>${counts.active} active, ${counts.pending} waiting for approval.</p></div>
      <div class="cluster"><button class="btn btn-primary btn-sm" type="button" data-add>Add client</button><button class="btn btn-quiet btn-sm" type="button" data-csv>Export CSV</button></div></div>
    <div class="toolbar">
      <div class="chip-row" role="group" aria-label="Status">${[...STATUS_ORDER, ''].map((s) => html`<button class="chip" type="button" data-s="${s}" aria-pressed="${state.status === s}">${s ? label('status', s) : 'All'}${s ? ` (${counts[s]})` : ''}</button>`)}</div>
      <input class="input" type="search" placeholder="Search name or email" data-q aria-label="Search clients">
    </div>
    <div data-list></div>
    ${invites.length ? html`<section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Pre-approved, not registered yet</h3></div>
      <div class="rows">${invites.map((i) => html`<div class="row"><div class="grow"><b>${i.full_name || i.email}</b><span>${i.email}${i.plan_name ? ` · ${i.plan_name}` : ''} · added ${timeAgo(i.created_at)}</span></div>
        <button class="btn btn-quiet btn-sm" type="button" data-copy-link>Copy sign-up link</button><button class="icon-btn" type="button" data-del-invite="${i.id}"><span class="sr-only">Remove</span>&times;</button></div>`)}</div>
      <p class="small muted" style="margin-top:8px">When they create an account with this email, it is approved automatically.</p></section>` : ''}`);

  const draw = () => {
    const t = state.term.toLowerCase();
    const list = rows.filter((r) => (!state.status || r.status === state.status) && (!t || `${r.full_name || ''} ${r.email || ''} ${r.phone || ''}`.toLowerCase().includes(t)));
    $$('[data-s]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === state.status)));
    setHTML($('[data-list]'), list.length ? html`<div class="table-wrap"><table class="table">
      <thead><tr><th>Client</th><th>Status</th><th>Plan</th><th>Ends</th><th>Goal</th><th>Joined</th></tr></thead>
      <tbody>${list.map((r) => html`<tr class="click-row" tabindex="0" data-href="client/${r.id}"><td><b>${r.full_name || '(no name)'}</b><div class="small muted">${r.email || ''}</div></td>
        <td>${statusTag(r.status, label('status', r.status))}</td><td>${r.plan_name || '-'}</td>
        <td>${r.plan_end ? html`<span class="${r.plan_end <= addDays(ymd(), 14) ? 'tag tag-warn' : ''}">${fmtDate(r.plan_end, { day: 'numeric', month: 'short', year: '2-digit' })}</span>` : '-'}</td>
        <td>${label('goal', r.goal) || '-'}</td><td>${fmtDate(r.created_at, { day: 'numeric', month: 'short', year: '2-digit' })}</td></tr>`)}</tbody></table></div>`
      : html`<div class="empty"><h3>No clients ${state.status ? `with status "${label('status', state.status)}"` : ''}</h3><p>${rows.length ? 'Try another filter.' : 'Share /portal/register with new clients, or add one here.'}</p></div>`);
    rowLinks(view);
  };
  $$('[data-s]').forEach((b) => b.addEventListener('click', () => { state.status = b.dataset.s; draw(); }));
  $('[data-q]').addEventListener('input', debounce((e) => { state.term = e.target.value; draw(); }, 150));
  $('[data-csv]').addEventListener('click', () => downloadFile(`clients-${ymd()}.csv`, toCSV(rows), 'text/csv'));
  $$('[data-copy-link]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(`${location.origin}/portal/register/`); toast('Sign-up link copied'); } catch { toast(`${location.origin}/portal/register/`); } }));
  $$('[data-del-invite]').forEach((b) => b.addEventListener('click', async () => { await supa.from('client_invites').delete().eq('id', b.dataset.delInvite); go('clients'); }));
  $('[data-add]').addEventListener('click', addClientModal);
  draw();
});

async function addClientModal() {
  const settings = await getSettings();
  openModal({
    title: 'Add a client',
    body: html`<p class="small muted" style="margin:0">If they already have an account, it is activated now. Otherwise their email is pre-approved and the account becomes active as soon as they register.</p>
      <div class="field"><label for="ac-email">Email</label><input class="input" id="ac-email" name="email" type="email" required></div>
      <div class="field"><label for="ac-name">Name</label><input class="input" id="ac-name" name="full_name" maxlength="100"></div>
      <div class="field"><label for="ac-plan">Coaching plan</label><select class="input" id="ac-plan" name="plan_name"><option value="">Choose later</option>${(settings.plans || []).map((p) => html`<option>${p.name}</option>`)}</select></div>`,
    submit: 'Add client',
    onSubmit: async (f) => {
      const email = f.elements.email.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email.');
      const existing = await q(supa.from('profiles').select('id,role').eq('email', email).limit(1).maybeSingle());
      if (existing) {
        if (existing.role !== 'client') throw new Error('That email belongs to a coach or admin account.');
        await q(supa.from('profiles').update({ status: 'active', plan_name: f.elements.plan_name.value || null, full_name: f.elements.full_name.value.trim() || undefined }).eq('id', existing.id));
        toast('Existing account activated. They have been emailed.'); refreshCounts(); go(`client/${existing.id}`); return;
      }
      await q(supa.from('client_invites').insert({ email, full_name: f.elements.full_name.value.trim() || null, plan_name: f.elements.plan_name.value || null }));
      try { await navigator.clipboard.writeText(`${location.origin}/portal/register/`); } catch { /* ignore */ }
      toast('Pre-approved. Sign-up link copied: send it to them.'); go('clients');
    },
  });
}

// ------------------------------------------------------------------ Client detail
const TABS = [['overview', 'Overview'], ['plan', 'Plan'], ['checkins', 'Check-ins'], ['food', 'Food'], ['workouts', 'Workouts'], ['progress', 'Progress'], ['files', 'Files'], ['notes', 'Notes'], ['payments', 'Payments'], ['profile', 'Profile']];

route('client', async (view, id, tab = 'overview') => {
  const c = await q(supa.from('profiles').select('*').eq('id', id).maybeSingle());
  if (!c) { setHTML(view, html`<div class="empty"><h3>Client not found</h3><p><a href="#clients">Back to clients</a></p></div>`); return; }
  const isAdmin = store.ctx.profile.role === 'admin';
  const wa = waLink(c.phone, `Hi ${(c.full_name || '').split(' ')[0]}, `);
  const actions = {
    pending: [['active', 'Approve', 'btn-primary'], ['rejected', 'Reject', 'btn-ghost']],
    active: [['completed', 'Mark completed', 'btn-ghost'], ['inactive', 'Deactivate', 'btn-quiet']],
    inactive: [['active', 'Reactivate', 'btn-primary']],
    completed: [['active', 'Start a new block', 'btn-primary']],
    rejected: [['active', 'Approve', 'btn-primary']],
  }[c.status] || [];
  setHTML(view, html`
    <p class="small"><a href="#clients">Clients</a></p>
    <div class="page-intro">
      <div><h2>${c.full_name || c.email}</h2><p>${c.email}${c.phone ? ` · ${c.phone}` : ''}${c.plan_name ? ` · ${c.plan_name}` : ''}</p></div>
      <div class="cluster">${statusTag(c.status, label('status', c.status))}${c.role !== 'client' ? html`<span class="tag tag-olive">${c.role}</span>` : ''}
        ${wa ? html`<a class="btn btn-ghost btn-sm" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${actions.map(([s, l, cls]) => html`<button class="btn ${cls} btn-sm" type="button" data-set-status="${s}">${l}</button>`)}</div>
    </div>
    ${c.status === 'pending' ? html`<div class="notice warn" style="margin-bottom:16px"><span>Approving gives ${c.full_name || 'them'} access to the portal and sends them an email. ${c.lead_id ? html`Their <a href="#lead/${c.lead_id}">enquiry</a> is linked.` : 'No enquiry is linked to this email.'}</span></div>` : ''}
    <div class="tabs" role="tablist" aria-label="Client sections" data-ctabs>${TABS.map(([k, l]) => html`<button role="tab" data-tab="${k}" id="ct-${k}" aria-controls="cp-${k}" aria-selected="${k === tab}" ${k === tab ? '' : raw('tabindex="-1"')}>${l}</button>`)}</div>
    ${TABS.map(([k]) => html`<section id="cp-${k}" role="tabpanel" aria-labelledby="ct-${k}" ${k === tab ? '' : raw('hidden')} data-panel="${k}"></section>`)}`);

  $$('[data-set-status]').forEach((b) => b.addEventListener('click', async () => {
    const s = b.dataset.setStatus;
    const msg = { active: c.status === 'pending' ? 'Approve this client? They get access to the portal and an email.' : 'Make this client active again?', rejected: 'Reject this account? They will not get portal access.', inactive: 'Deactivate this client? They can log in but cannot add new logs.', completed: 'Mark coaching as completed? They keep read access to their history.' }[s];
    if (!(await confirmDialog({ title: b.textContent, body: msg, confirm: b.textContent, danger: s === 'rejected' || s === 'inactive' }))) return;
    try { await q(supa.from('profiles').update({ status: s }).eq('id', id)); toast(`${label('status', s)}`); refreshCounts(); go(`client/${id}/${tab}`); } catch (err) { toast(err.message, 'error'); }
  }));

  const loaders = { overview, plan: (el) => renderPlanTab(el, c), checkins, food, workouts, progress, files, notes, payments: (el) => paymentsTab(el, c, isAdmin), profile: (el) => profileTab(el, c, isAdmin) };
  const loaded = new Set();
  const load = (k) => {
    if (loaded.has(k)) return;
    loaded.add(k);
    const el = $(`[data-panel="${k}"]`);
    setHTML(el, html`<div class="skeleton" style="height:200px"></div>`);
    Promise.resolve(loaders[k](el, c)).catch((err) => setHTML(el, html`<div class="notice danger">${err.message}</div>`));
  };
  initTabs($('[data-ctabs]'), (k) => { history.replaceState(null, '', `#client/${id}/${k}`); load(k); });
  load(tab);
});

async function overview(el, c) {
  const [weights, checkins, daily, foodRows, workoutsN, notesPinned] = await Promise.all([
    q(supa.from('progress_records').select('record_date,weight_kg,waist_cm').eq('client_id', c.id).order('record_date')),
    q(supa.from('weekly_checkins').select('*').eq('client_id', c.id).order('week_of', { ascending: false }).limit(4)),
    q(supa.from('daily_logs').select('log_date,steps,workout_done,sleep_hours').eq('client_id', c.id).gte('log_date', addDays(ymd(), -13))),
    q(supa.from('food_logs').select('log_date,calories,protein_g').eq('client_id', c.id).gte('log_date', addDays(ymd(), -13))),
    q(supa.from('workout_logs').select('log_date').eq('client_id', c.id).gte('log_date', addDays(ymd(), -13))),
    q(supa.from('coach_notes').select('*').eq('client_id', c.id).eq('pinned', true).order('created_at', { ascending: false })),
  ]);
  const w = weights.filter((x) => x.weight_kg != null);
  const lastW = w.at(-1); const firstW = w[0];
  const loggedDates = new Set([...daily.map((d) => d.log_date), ...foodRows.map((f) => f.log_date), ...workoutsN.map((x) => x.log_date)]);
  const wDays = new Set([...daily.filter((d) => d.workout_done).map((d) => d.log_date), ...workoutsN.map((x) => x.log_date)]);
  const byDay = {}; foodRows.forEach((f) => { (byDay[f.log_date] ||= []).push(f); });
  const avgKcal = Object.values(byDay).length ? Object.values(byDay).reduce((s, rows) => s + sumMacros(rows).calories, 0) / Object.values(byDay).length : null;
  const avgPro = Object.values(byDay).length ? Object.values(byDay).reduce((s, rows) => s + sumMacros(rows).protein_g, 0) / Object.values(byDay).length : null;
  setHTML(el, html`
    ${notesPinned.length ? html`<div class="notice ok" style="margin-bottom:16px"><span><b>Pinned note:</b> ${notesPinned[0].body}</span></div>` : ''}
    <div class="stats">
      <div class="stat"><span class="stat-label">Latest weight</span><span class="stat-value">${lastW ? fmtNum(lastW.weight_kg, 1) : '-'}<small>kg</small></span><span class="stat-sub">${lastW ? fmtDate(lastW.record_date) : 'No weigh-ins'}</span></div>
      <div class="stat"><span class="stat-label">Change</span><span class="stat-value">${firstW && lastW ? `${lastW.weight_kg - firstW.weight_kg > 0 ? '+' : ''}${fmtNum(lastW.weight_kg - firstW.weight_kg, 1)}` : '-'}<small>kg</small></span><span class="stat-sub">${c.target_weight ? `Target ${fmtNum(c.target_weight, 1)} kg` : 'No target set'}</span></div>
      <div class="stat"><span class="stat-label">Logged, last 14 days</span><span class="stat-value">${loggedDates.size}<small>/14 days</small></span><span class="stat-sub">${wDays.size} workout days</span></div>
      <div class="stat"><span class="stat-label">Avg food logged</span><span class="stat-value">${avgKcal != null ? fmtNum(avgKcal) : '-'}<small>kcal</small></span><span class="stat-sub">${avgPro != null ? `${fmtNum(avgPro)} g protein` : 'No food logs'}</span></div>
      <div class="stat"><span class="stat-label">Last check-in</span><span class="stat-value" style="font-size:1.3rem">${checkins[0] ? fmtDate(checkins[0].week_of, { day: 'numeric', month: 'short' }) : '-'}</span><span class="stat-sub">${checkins[0] ? label('status', checkins[0].status) || checkins[0].status.replace('_', ' ') : `Due ${weekdayName(c.checkin_day ?? 0)}s`}</span></div>
    </div>
    <div class="panel-grid">
      <section class="panel"><div class="panel-head"><h3>Weight trend</h3></div><div data-chart></div></section>
      <section class="panel"><div class="panel-head"><h3>Details</h3></div>
        <dl class="dl">
          <dt>Goal</dt><dd>${label('goal', c.goal) || '-'}</dd><dt>Diet</dt><dd>${label('diet', c.diet_preference) || '-'}</dd>
          <dt>Height</dt><dd>${c.height_cm ? `${c.height_cm} cm` : '-'}</dd><dt>Start weight</dt><dd>${c.start_weight ? `${fmtNum(c.start_weight, 1)} kg` : '-'}</dd>
          <dt>Plan</dt><dd>${c.plan_name || '-'}${c.plan_end ? ` until ${fmtDate(c.plan_end)}` : ''}</dd><dt>Check-in day</dt><dd>${weekdayName(c.checkin_day ?? 0)}</dd>
          <dt>Approved</dt><dd>${c.approved_at ? fmtDate(c.approved_at) : '-'}</dd><dt>Emails</dt><dd>${c.email_notifications ? 'On' : 'Off'}</dd>
          ${c.lead_id ? html`<dt>Enquiry</dt><dd><a href="#lead/${c.lead_id}">Open enquiry</a></dd>` : ''}
        </dl>
        <div class="cluster" style="margin-top:14px"><button class="btn btn-ghost btn-sm" type="button" data-export>Export all data (CSV)</button><button class="btn btn-quiet btn-sm" type="button" data-report>Progress report</button></div>
      </section>
    </div>`);
  lineChart($('[data-chart]', el), [
    { name: 'Weigh-ins', points: w.map((x) => ({ x: x.record_date, y: Number(x.weight_kg) })) },
    { name: '7-day average', points: movingAverage(w.map((x) => ({ date: x.record_date, value: Number(x.weight_kg) }))).map((p) => ({ x: p.date, y: p.value })), dots: false },
  ], { unit: ' kg', goal: c.target_weight, label: 'Weight trend', emptyText: 'No weigh-ins yet.' });
  $('[data-export]', el).addEventListener('click', (e) => busy(e.currentTarget, () => exportClient(c)));
  $('[data-report]', el).addEventListener('click', () => printReport(c, w));
}

async function exportClient(c) {
  const tables = ['daily_logs', 'food_logs', 'workout_logs', 'progress_records', 'weekly_checkins', 'weekly_logs', 'payments'];
  const parts = [];
  for (const t of tables) {
    const { data } = await supa.from(t).select('*').eq('client_id', c.id);
    if (data?.length) parts.push(`# ${t}\n${toCSV(data)}`);
  }
  downloadFile(`${(c.full_name || 'client').replace(/\W+/g, '-').toLowerCase()}-${ymd()}.csv`, parts.join('\n\n') || 'No data', 'text/csv');
}

function printReport(c, w) {
  const win = window.open('', '_blank');
  if (!win) { toast('Allow pop-ups to open the report.', 'error'); return; }
  const first = w[0]; const last = w.at(-1);
  win.document.write(`<!doctype html><title>${c.full_name} progress report</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;color:#171A18}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style>
    <h1>${String(c.full_name || '').replace(/</g, '&lt;')}: progress report</h1><p>${new Date().toLocaleDateString('en-IN')} · ${c.plan_name || ''}</p>
    <p>Weight: ${first ? `${first.weight_kg} kg on ${first.record_date}` : '-'} to ${last ? `${last.weight_kg} kg on ${last.record_date}` : '-'}${c.target_weight ? `, target ${c.target_weight} kg` : ''}</p>
    <table><tr><th>Date</th><th>Weight (kg)</th><th>Waist (cm)</th></tr>${w.slice(-20).map((x) => `<tr><td>${x.record_date}</td><td>${x.weight_kg ?? ''}</td><td>${x.waist_cm ?? ''}</td></tr>`).join('')}</table>
    <script>window.print()<\/script>`);
  win.document.close();
}

async function checkins(el, c) {
  const rows = await q(supa.from('weekly_checkins').select('*').eq('client_id', c.id).order('week_of', { ascending: false }).limit(26));
  if (!rows.length) { setHTML(el, html`<div class="empty"><h3>No check-ins yet</h3><p>${c.full_name || 'This client'} checks in every ${weekdayName(c.checkin_day ?? 0)}.</p></div>`); return; }
  setHTML(el, html`<div class="stack" style="--stack:16px" data-cards></div>`);
  const box = $('[data-cards]', el);
  for (const r of rows) box.appendChild(await checkinCard({ ...r, profiles: { full_name: c.full_name } }, { showName: false, onDone: () => checkins(el, c) }));
}

async function food(el, c) {
  const from = addDays(ymd(), -13);
  const rows = await q(supa.from('food_logs').select('*').eq('client_id', c.id).gte('log_date', from).order('log_date', { ascending: false }).order('created_at'));
  const daily = await q(supa.from('daily_logs').select('*').eq('client_id', c.id).gte('log_date', from));
  const days = [...new Set([...rows.map((r) => r.log_date), ...daily.map((d) => d.log_date)])].sort().reverse();
  setHTML(el, days.length ? html`<p class="small muted">Last 14 days.</p>${days.map((d) => {
    const items = rows.filter((r) => r.log_date === d); const t = sumMacros(items); const dl = daily.find((x) => x.log_date === d);
    return html`<details class="day" style="margin-bottom:10px"><summary>${fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}<span>${items.length ? `${fmtNum(t.calories)} kcal · P ${fmtNum(t.protein_g)} g · C ${fmtNum(t.carbs_g)} · F ${fmtNum(t.fat_g)}` : dl?.calories ? `Totals: ${fmtNum(dl.calories)} kcal · P ${fmtNum(dl.protein_g || 0)} g` : 'No food'}${dl ? ` · ${dl.steps ? `${fmtNum(dl.steps)} steps` : ''}${dl.workout_done ? ' · trained' : ''}` : ''}</span></summary>
      ${items.length ? html`<table class="ex-table"><tbody>${items.map((r) => html`<tr><td><b>${label('meal', r.meal)}</b> ${r.food_name}${r.quantity ? html` <span class="muted">${fmtNum(r.quantity, 1)} ${r.unit || ''}</span>` : ''}${r.notes ? html`<div class="ex-note">${r.notes}</div>` : ''}</td><td>${fmtNum(r.calories || 0)} kcal</td><td>P ${fmtNum(r.protein_g || 0)}</td></tr>`)}</tbody></table>` : ''}
      ${dl?.notes ? html`<p class="small" style="padding:10px 16px;margin:0">${dl.notes}</p>` : ''}</details>`;
  })}` : html`<div class="empty"><h3>No food logged in the last 14 days</h3></div>`);
}

async function workouts(el, c) {
  const rows = await q(supa.from('workout_logs').select('*').eq('client_id', c.id).gte('log_date', addDays(ymd(), -41)).order('log_date', { ascending: false }).order('created_at'));
  const days = [...new Set(rows.map((r) => r.log_date))];
  setHTML(el, days.length ? html`<p class="small muted">Last 6 weeks: ${days.length} sessions.</p>${days.map((d) => html`<details class="day" style="margin-bottom:10px"><summary>${fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}<span>${rows.filter((r) => r.log_date === d).length} exercises</span></summary>
    <table class="ex-table"><tbody>${rows.filter((r) => r.log_date === d).map((r) => html`<tr><td class="ex-name">${r.exercise}${r.notes ? html`<div class="ex-note">${r.notes}</div>` : ''}</td><td>${r.sets || '-'} x ${r.reps || '-'}</td><td>${r.weight_kg != null ? `${fmtNum(r.weight_kg, 1)} kg` : ''}${r.duration_min ? ` ${fmtNum(r.duration_min)} min` : ''}</td><td class="muted">${r.est_1rm ? `1RM ~${fmtNum(r.est_1rm, 1)}` : ''}</td></tr>`)}</tbody></table></details>`)}`
    : html`<div class="empty"><h3>No workouts logged in the last 6 weeks</h3></div>`);
}

async function progress(el, c) {
  const [recs, photos] = await Promise.all([
    q(supa.from('progress_records').select('*').eq('client_id', c.id).order('record_date', { ascending: false })),
    q(supa.from('progress_photos').select('*').eq('client_id', c.id).order('taken_on', { ascending: false }).limit(60)),
  ]);
  const urls = await signedUrls('client-photos', photos.map((p) => p.path));
  const M = [['weight_kg', 'Weight'], ['waist_cm', 'Waist'], ['chest_cm', 'Chest'], ['arms_cm', 'Arms'], ['hips_cm', 'Hips'], ['thighs_cm', 'Thighs'], ['body_fat_pct', 'BF %']];
  setHTML(el, html`
    <section class="panel"><div class="panel-head"><h3>Measurements</h3></div>
      ${recs.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Date</th>${M.map(([, l]) => html`<th class="num">${l}</th>`)}<th>Source</th></tr></thead>
      <tbody>${recs.map((r) => html`<tr><td>${fmtDate(r.record_date)}</td>${M.map(([k]) => html`<td class="num">${r[k] != null ? fmtNum(r[k], 1) : '-'}</td>`)}<td>${r.source}</td></tr>`)}</tbody></table></div>` : html`<p class="muted small">No measurements yet.</p>`}
    </section>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Progress photos</h3><span class="small muted">Private. Links expire after an hour.</span></div>
      ${photos.length ? html`<div class="photo-grid">${photos.map((p) => html`<figure class="photo">${urls[p.path] ? html`<a href="${urls[p.path]}" target="_blank" rel="noopener"><img src="${urls[p.path]}" alt="${p.pose}, ${fmtDate(p.taken_on)}" loading="lazy"></a>` : ''}<figcaption><span>${p.pose}</span><span>${fmtDate(p.taken_on, { day: 'numeric', month: 'short' })}</span></figcaption></figure>`)}</div>` : html`<p class="muted small">No photos uploaded.</p>`}
    </section>`);
}

async function files(el, c) {
  const rows = await q(supa.from('client_files').select('*').eq('client_id', c.id).order('uploaded_at', { ascending: false }));
  const urls = await signedUrls('client-plans', rows.map((r) => r.file_url));
  setHTML(el, html`<div class="panel-grid">
    <section class="panel"><div class="panel-head"><h3>Shared with ${c.full_name || 'client'}</h3></div>
      ${rows.length ? html`<div class="rows">${rows.map((r) => html`<div class="row"><div class="grow"><b>${r.title}</b><span>${r.description || ''} · ${fmtDate(r.uploaded_at)}</span></div>${urls[r.file_url] ? html`<a class="btn btn-quiet btn-sm" href="${urls[r.file_url]}" target="_blank" rel="noopener">Open</a>` : ''}<button class="btn btn-quiet btn-sm" type="button" data-del="${r.id}">Delete</button></div>`)}</div>` : html`<p class="muted small">No files yet.</p>`}
    </section>
    <section class="panel"><div class="panel-head"><h3>Upload a file</h3></div>
      <form class="form" data-up>
        <div class="field"><label for="fu-t">Title</label><input class="input" id="fu-t" name="title" required maxlength="120" placeholder="e.g. Meal plan, weeks 1 to 4"></div>
        <div class="field"><label for="fu-d">Description</label><input class="input" id="fu-d" name="description" maxlength="300"></div>
        <div class="field"><label for="fu-f">File (PDF or image, up to 25 MB)</label><input class="input" id="fu-f" name="file" type="file" accept="application/pdf,image/*" required></div>
        <button class="btn btn-primary btn-sm" type="submit">Upload and share</button>
      </form></section></div>`);
  $('[data-up]', el).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements; const file = f.file.files[0];
    if (!f.title.value.trim() || !file) { toast('Add a title and choose a file.', 'error'); return; }
    if (file.size > 25e6) { toast('File must be under 25 MB.', 'error'); return; }
    busy(e.target.querySelector('button'), async () => {
      try {
        const path = `${c.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '-').slice(-60)}`;
        const { error } = await supa.storage.from('client-plans').upload(path, file, { contentType: file.type });
        if (error) throw new Error(error.message);
        await q(supa.from('client_files').insert({ client_id: c.id, title: f.title.value.trim(), description: f.description.value.trim() || null, file_url: path, file_type: file.type }));
        await supa.rpc('notify_client', { p_client: c.id, p_title: `New file: ${f.title.value.trim()}`, p_link: '/portal/library/' });
        toast('Shared'); files(el, c);
      } catch (err) { toast(err.message, 'error'); }
    });
  });
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', async () => {
    const r = rows.find((x) => x.id === b.dataset.del);
    if (!(await confirmDialog({ title: 'Delete this file?', body: `"${r.title}" will be removed for the client too.` }))) return;
    await supa.storage.from('client-plans').remove([r.file_url]);
    await supa.from('client_files').delete().eq('id', r.id);
    toast('Deleted'); files(el, c);
  }));
}

async function notes(el, c) {
  const rows = await q(supa.from('coach_notes').select('*, author:profiles!coach_notes_author_id_fkey(full_name)').eq('client_id', c.id).order('pinned', { ascending: false }).order('created_at', { ascending: false }));
  setHTML(el, html`<section class="panel"><div class="panel-head"><h3>Private coach notes</h3><span class="small muted">Never shown to the client</span></div>
    <form class="form" data-add><textarea class="input" name="body" maxlength="5000" placeholder="Injuries, preferences, what worked, conversation notes" aria-label="New note"></textarea><div class="cluster"><label class="check"><input type="checkbox" name="pinned"> Pin to overview</label><button class="btn btn-primary btn-sm" type="submit">Add note</button></div></form>
    <div class="rows" style="margin-top:16px">${rows.map((n) => html`<div class="row" style="align-items:flex-start"><div class="grow"><div class="pre-wrap" style="font-size:var(--t-sm)">${n.body}</div><span>${fmtDateTime(n.created_at)}${n.author?.full_name ? ` · ${n.author.full_name}` : ''}${n.pinned ? ' · pinned' : ''}</span></div>
      <button class="btn btn-quiet btn-sm" type="button" data-pin="${n.id}">${n.pinned ? 'Unpin' : 'Pin'}</button><button class="btn btn-quiet btn-sm" type="button" data-del="${n.id}">Delete</button></div>`)}</div></section>`);
  $('[data-add]', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = e.target.elements.body.value.trim(); if (!body) return;
    try { await q(supa.from('coach_notes').insert({ client_id: c.id, body, pinned: e.target.elements.pinned.checked })); notes(el, c); } catch (err) { toast(err.message, 'error'); }
  });
  $$('[data-pin]', el).forEach((b) => b.addEventListener('click', async () => { const n = rows.find((x) => x.id === b.dataset.pin); await supa.from('coach_notes').update({ pinned: !n.pinned }).eq('id', n.id); notes(el, c); }));
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', async () => { if (await confirmDialog({ title: 'Delete note?', body: 'This cannot be undone.' })) { await supa.from('coach_notes').delete().eq('id', b.dataset.del); notes(el, c); } }));
}

export async function paymentsTab(el, c, isAdmin) {
  const rows = await q(supa.from('payments').select('*').eq('client_id', c.id).order('paid_on', { ascending: false }));
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  setHTML(el, html`<section class="panel"><div class="panel-head"><h3>Payments</h3>${isAdmin ? html`<button class="btn btn-primary btn-sm" type="button" data-add>Record payment</button>` : ''}</div>
    ${rows.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Paid on</th><th class="num">Amount</th><th>Plan</th><th>Covers</th><th>Method</th><th>Reference</th>${isAdmin ? html`<th></th>` : ''}</tr></thead>
      <tbody>${rows.map((r) => html`<tr><td>${fmtDate(r.paid_on)}</td><td class="num">${fmtMoney(r.amount, r.currency)}</td><td>${r.plan_name || '-'}</td><td>${r.period_start ? `${fmtDate(r.period_start, { day: 'numeric', month: 'short' })} to ${fmtDate(r.period_end)}` : '-'}</td><td>${r.method || '-'}</td><td>${r.reference || ''}</td>${isAdmin ? html`<td><button class="btn btn-quiet btn-sm" type="button" data-edit="${r.id}">Edit</button></td>` : ''}</tr>`)}</tbody></table></div>
      <p class="small muted" style="margin-top:8px">Total ${fmtMoney(total)}. The latest "covers until" date becomes the client's plan end date, which drives renewal reminders.</p>`
    : html`<p class="muted small">No payments recorded. Payments are taken outside the site (UPI, bank transfer); record them here to track renewals.</p>`}</section>`);
  const modal = async (r = {}) => {
    const settings = await getSettings();
    openModal({
      title: r.id ? 'Edit payment' : 'Record payment',
      danger: r.id ? 'Delete' : null,
      body: html`<div class="form-row"><div class="field"><label for="py-a">Amount (INR)</label><input class="input" id="py-a" name="amount" type="number" min="1" step="1" value="${r.amount ?? ''}" required></div>
        <div class="field"><label for="py-d">Paid on</label><input class="input" id="py-d" name="paid_on" type="date" value="${r.paid_on || ymd()}" required></div></div>
        <div class="form-row"><div class="field"><label for="py-p">Plan</label><input class="input" id="py-p" name="plan_name" list="plan-names" value="${r.plan_name || c.plan_name || ''}"><datalist id="plan-names">${(settings.plans || []).map((p) => html`<option value="${p.name}"></option>`)}</datalist></div>
        <div class="field"><label for="py-m">Method</label><select class="input" id="py-m" name="method">${['upi', 'bank_transfer', 'card', 'cash', 'other'].map((m) => html`<option value="${m}" ${r.method === m ? raw('selected') : ''}>${m.replace('_', ' ')}</option>`)}</select></div></div>
        <div class="form-row"><div class="field"><label for="py-s">Covers from</label><input class="input" id="py-s" name="period_start" type="date" value="${r.period_start || ymd()}"></div>
        <div class="field"><label for="py-e">Covers until</label><input class="input" id="py-e" name="period_end" type="date" value="${r.period_end || ''}"></div></div>
        <div class="field"><label for="py-r">Reference</label><input class="input" id="py-r" name="reference" maxlength="120" value="${r.reference || ''}" placeholder="UPI transaction ID"></div>
        <div class="field"><label for="py-n">Notes</label><input class="input" id="py-n" name="notes" maxlength="1000" value="${r.notes || ''}"></div>`,
      onSubmit: async (f) => {
        const e = f.elements;
        const row = { client_id: c.id, amount: numOrNull(e.amount.value), paid_on: e.paid_on.value, plan_name: e.plan_name.value.trim() || null, method: e.method.value, period_start: e.period_start.value || null, period_end: e.period_end.value || null, reference: e.reference.value.trim() || null, notes: e.notes.value.trim() || null };
        if (!(row.amount > 0)) throw new Error('Enter the amount.');
        if (row.period_start && row.period_end && row.period_end < row.period_start) throw new Error('"Covers until" must be after "Covers from".');
        if (r.id) await q(supa.from('payments').update(row).eq('id', r.id)); else await q(supa.from('payments').insert(row));
        toast('Payment saved'); paymentsTab(el, c, isAdmin);
      },
    });
    document.querySelector('[data-danger]')?.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Delete payment?', body: 'This removes the record.' }))) return;
      await supa.from('payments').delete().eq('id', r.id); document.querySelector('dialog.modal')?.remove(); paymentsTab(el, c, isAdmin);
    });
    // Suggest an end date from the plan duration.
    const pd = document.getElementById('py-p'); const ps = document.getElementById('py-s'); const pe = document.getElementById('py-e');
    const suggest = () => {
      if (pe.value) return;
      const p = (settings.plans || []).find((x) => x.name === pd.value); const weeks = Number(String(p?.duration || '').match(/\d+/)?.[0]);
      if (weeks && ps.value) pe.value = addDays(ps.value, weeks * 7 - 1);
    };
    pd.addEventListener('change', suggest); ps.addEventListener('change', suggest); suggest();
  };
  $('[data-add]', el)?.addEventListener('click', () => modal());
  $$('[data-edit]', el).forEach((b) => b.addEventListener('click', () => modal(rows.find((x) => x.id === b.dataset.edit))));
}

async function profileTab(el, c, isAdmin) {
  const settings = await getSettings();
  const opt = (v, cur, t) => html`<option value="${v}" ${String(cur ?? '') === String(v) ? raw('selected') : ''}>${t}</option>`;
  setHTML(el, html`<section class="panel"><div class="panel-head"><h3>Edit client</h3></div>
    <form class="form" data-pf>
      <div class="form-row"><div class="field"><label for="cp-n">Name</label><input class="input" id="cp-n" name="full_name" value="${c.full_name || ''}"></div>
        <div class="field"><label for="cp-ph">WhatsApp</label><input class="input" id="cp-ph" name="phone" value="${c.phone || ''}"></div></div>
      <div class="form-row"><div class="field"><label for="cp-plan">Coaching plan</label><input class="input" id="cp-plan" name="plan_name" list="cp-plans" value="${c.plan_name || ''}"><datalist id="cp-plans">${(settings.plans || []).map((p) => html`<option value="${p.name}"></option>`)}</datalist></div>
        <div class="field"><label for="cp-ps">Plan start</label><input class="input" id="cp-ps" name="plan_start" type="date" value="${c.plan_start || ''}"></div>
        <div class="field"><label for="cp-pe">Plan end</label><input class="input" id="cp-pe" name="plan_end" type="date" value="${c.plan_end || ''}"></div></div>
      <div class="form-row"><div class="field"><label for="cp-sw">Start weight (kg)</label><input class="input" id="cp-sw" name="start_weight" type="number" step="0.1" min="30" max="300" value="${c.start_weight ?? ''}"></div>
        <div class="field"><label for="cp-tw">Target weight (kg)</label><input class="input" id="cp-tw" name="target_weight" type="number" step="0.1" min="30" max="300" value="${c.target_weight ?? ''}"></div>
        <div class="field"><label for="cp-h">Height (cm)</label><input class="input" id="cp-h" name="height_cm" type="number" min="100" max="250" value="${c.height_cm ?? ''}"></div></div>
      <div class="form-row"><div class="field"><label for="cp-g">Goal</label><select class="input" id="cp-g" name="goal">${opt('', c.goal, '-')}${Object.entries(LABELS.goal).map(([k, v]) => opt(k, c.goal, v))}</select></div>
        <div class="field"><label for="cp-d">Diet</label><select class="input" id="cp-d" name="diet_preference">${opt('', c.diet_preference, '-')}${['vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'jain'].map((k) => opt(k, c.diet_preference, label('diet', k)))}</select></div>
        <div class="field"><label for="cp-ci">Check-in day</label><select class="input" id="cp-ci" name="checkin_day">${[1, 2, 3, 4, 5, 6, 0].map((d) => opt(d, c.checkin_day, weekdayName(d)))}</select></div></div>
      <div class="field"><label for="cp-notes">Notes (visible only to coaches)</label><textarea class="input" id="cp-notes" name="notes">${c.notes || ''}</textarea></div>
      <button class="btn btn-primary btn-sm" type="submit">Save</button>
    </form></section>
    ${isAdmin ? html`<section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Role</h3></div>
      <p class="small muted">Coaches can manage clients, plans and content. Only admins manage payments, the activity log and roles.</p>
      <div class="cluster"><select class="input" data-role style="width:auto;min-height:40px" aria-label="Role">${['client', 'coach', 'admin'].map((r) => opt(r, c.role, r))}</select><button class="btn btn-ghost btn-sm" type="button" data-save-role>Change role</button></div></section>` : ''}`);
  $('[data-pf]', el).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const row = { full_name: f.full_name.value.trim() || null, phone: f.phone.value.trim() || null, plan_name: f.plan_name.value.trim() || null, plan_start: f.plan_start.value || null, plan_end: f.plan_end.value || null, start_weight: numOrNull(f.start_weight.value), target_weight: numOrNull(f.target_weight.value), height_cm: numOrNull(f.height_cm.value), goal: f.goal.value || null, diet_preference: f.diet_preference.value || null, checkin_day: Number(f.checkin_day.value), notes: f.notes.value.trim() || null };
    busy(e.target.querySelector('button'), async () => { try { await q(supa.from('profiles').update(row).eq('id', c.id)); toast('Saved'); } catch (err) { toast(err.message, 'error'); } });
  });
  $('[data-save-role]', el)?.addEventListener('click', async () => {
    const role = $('[data-role]', el).value;
    if (role === c.role) return;
    if (!(await confirmDialog({ title: `Make ${c.full_name || 'this user'} ${role === 'client' ? 'a client' : `a ${role}`}?`, body: role === 'client' ? 'They lose access to the coach dashboard.' : 'They will be able to see every client\'s data.', confirm: 'Change role', danger: role !== 'client' }))) return;
    try { await q(supa.from('profiles').update({ role, status: 'active' }).eq('id', c.id)); toast('Role changed'); go(`client/${c.id}/profile`); } catch (err) { toast(err.message, 'error'); }
  });
}
