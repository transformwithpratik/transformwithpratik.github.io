import { route, go, rowLinks, statusTag, refreshCounts, q, supa } from './shell.js';
import { $, $$, html, raw, setHTML, fmtNum, fmtDate, fmtDateTime, timeAgo, label, LABELS, waLink, toast, confirmDialog, busy, debounce, downloadFile, toCSV, ymd } from '../lib/util.js';
import { openModal } from '../lib/portal.js';
import { getSettings } from '../lib/settings.js';

route('leads', async (view, filter = '') => {
  let rows = await q(supa.from('leads').select('*').order('created_at', { ascending: false }).limit(1000));
  const state = { status: filter || 'open', term: '' };
  setHTML(view, html`
    <div class="page-intro"><div><h2>Leads</h2><p>Every enquiry from the website, newest first.</p></div>
      <div class="cluster"><button class="btn btn-ghost btn-sm" type="button" data-add>Add lead</button><button class="btn btn-quiet btn-sm" type="button" data-csv>Export CSV</button></div></div>
    <div class="toolbar">
      <input class="input" type="search" placeholder="Search name, email, phone" data-q aria-label="Search leads">
      <select class="input" data-status aria-label="Status">
        <option value="open">Open (new, contacted, consult booked)</option><option value="">All statuses</option>
        ${Object.entries(LABELS.lead).map(([k, v]) => html`<option value="${k}">${v}</option>`)}
      </select>
    </div>
    <div data-list></div>`);
  $('[data-status]').value = state.status;
  const draw = () => {
    const t = state.term.toLowerCase();
    const list = rows.filter((r) => (state.status === 'open' ? ['new', 'contacted', 'consult_booked'].includes(r.status) : !state.status || r.status === state.status)
      && (!t || `${r.name} ${r.email || ''} ${r.whatsapp || ''}`.toLowerCase().includes(t)));
    setHTML($('[data-list]'), list.length ? html`<div class="table-wrap"><table class="table">
      <thead><tr><th>Name</th><th>Goal</th><th>Plan interest</th><th>Status</th><th>Follow up</th><th>Received</th></tr></thead>
      <tbody>${list.map((r) => html`<tr class="click-row" tabindex="0" data-href="lead/${r.id}"><td><b>${r.name}</b><div class="small muted">${r.email || ''}${r.whatsapp ? ` · ${r.whatsapp}` : ''}</div></td>
        <td>${label('goal', r.goal) || '-'}</td><td>${r.plan_interest || '-'}</td><td>${statusTag(r.status, label('lead', r.status))}</td>
        <td>${r.next_follow_up ? html`<span class="${r.next_follow_up <= ymd() ? 'tag tag-warn' : ''}">${fmtDate(r.next_follow_up, { day: 'numeric', month: 'short' })}</span>` : '-'}</td><td>${timeAgo(r.created_at)}</td></tr>`)}</tbody></table></div>`
      : html`<div class="empty"><h3>No leads here</h3><p>${rows.length ? 'Try another filter.' : 'Enquiries from the Start your transformation form will appear here.'}</p></div>`);
    rowLinks(view);
  };
  $('[data-q]').addEventListener('input', debounce((e) => { state.term = e.target.value; draw(); }, 150));
  $('[data-status]').addEventListener('change', (e) => { state.status = e.target.value; draw(); });
  $('[data-csv]').addEventListener('click', () => downloadFile(`leads-${ymd()}.csv`, toCSV(rows.map(({ utm, ...r }) => ({ ...r, utm: utm ? JSON.stringify(utm) : '' }))), 'text/csv'));
  $('[data-add]').addEventListener('click', () => openModal({
    title: 'Add a lead',
    body: html`<p class="small muted" style="margin:0">For enquiries that came in by DM, WhatsApp or referral.</p>
      <div class="form-row"><div class="field"><label for="nl-name">Name</label><input class="input" id="nl-name" name="name" required maxlength="100"></div>
      <div class="field"><label for="nl-src">Source</label><select class="input" id="nl-src" name="source"><option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option><option value="referral">Referral</option><option value="other">Other</option></select></div></div>
      <div class="form-row"><div class="field"><label for="nl-email">Email</label><input class="input" id="nl-email" name="email" type="email"></div>
      <div class="field"><label for="nl-wa">WhatsApp</label><input class="input" id="nl-wa" name="whatsapp" type="tel" maxlength="20"></div></div>
      <div class="field"><label for="nl-goal">Goal</label><select class="input" id="nl-goal" name="goal"><option value="">Not known</option>${Object.entries(LABELS.goal).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></div>
      <div class="field"><label for="nl-notes">Notes</label><textarea class="input" id="nl-notes" name="admin_notes" maxlength="2000"></textarea></div>`,
    submit: 'Add lead',
    onSubmit: async (f) => {
      const e = f.elements;
      const row = { name: e.name.value.trim(), source: e.source.value, email: e.email.value.trim().toLowerCase() || null, whatsapp: e.whatsapp.value.replace(/[^0-9+]/g, '') || null, goal: e.goal.value || null, admin_notes: e.admin_notes.value.trim() || null, consent: true };
      if (!row.name) throw new Error('Enter a name.');
      if (row.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) throw new Error('Check the email address.');
      const created = await q(supa.from('leads').insert(row).select('id').single());
      await supa.from('lead_events').insert({ lead_id: created.id, kind: 'created', to_status: 'new', note: `Added manually (${row.source})` });
      toast('Lead added'); go(`lead/${created.id}`);
    },
  }));
  draw();
});

route('lead', async (view, id) => {
  const [lead, events, settings] = await Promise.all([
    q(supa.from('leads').select('*').eq('id', id).maybeSingle()),
    q(supa.from('lead_events').select('*, actor:profiles!lead_events_actor_id_fkey(full_name)').eq('lead_id', id).order('created_at', { ascending: false })),
    getSettings(),
  ]);
  if (!lead) { setHTML(view, html`<div class="empty"><h3>Lead not found</h3><p><a href="#leads">Back to leads</a></p></div>`); return; }
  const account = lead.email ? await q(supa.from('profiles').select('id,status,full_name').eq('email', lead.email.toLowerCase()).limit(1).maybeSingle()) : null;
  const first = lead.name.split(' ')[0];
  const wa = waLink(lead.whatsapp, `Hi ${first}, this is Pratik from GetFitWithPratik. Thanks for sharing your details about ${label('goal', lead.goal).toLowerCase() || 'your fitness goals'}. When would be a good time for a quick call this week?`);
  const field = (k, l, fmt = (v) => v) => (lead[k] != null && lead[k] !== '' ? html`<dt>${l}</dt><dd class="pre-wrap">${fmt(lead[k])}</dd>` : '');
  setHTML(view, html`
    <p class="small"><a href="#leads">Leads</a></p>
    <div class="page-intro"><div><h2>${lead.name}</h2><p>Received ${fmtDateTime(lead.created_at)} · ${lead.source.replace('_', ' ')}</p></div>
      <div class="cluster">${statusTag(lead.status, label('lead', lead.status))}
        ${wa ? html`<a class="btn btn-primary btn-sm" href="${wa}" target="_blank" rel="noopener" data-contacted>WhatsApp</a>` : ''}
        ${lead.email ? html`<a class="btn btn-ghost btn-sm" href="mailto:${lead.email}?subject=${encodeURIComponent('Your GetFitWithPratik enquiry')}" data-contacted>Email</a>` : ''}</div></div>
    ${account ? html`<div class="notice ok" style="margin-bottom:16px"><span>This person has a portal account (${label('status', account.status)}). <a href="#client/${account.id}">Open client</a></span></div>` : ''}
    <div class="detail-grid">
      <div class="stack" style="--stack:16px">
        <section class="panel"><div class="panel-head"><h3>Enquiry</h3></div>
          <dl class="dl">
            ${field('email', 'Email')}${field('whatsapp', 'WhatsApp')}${field('age', 'Age')}${field('height_cm', 'Height', (v) => `${v} cm`)}${field('weight_kg', 'Weight', (v) => `${fmtNum(v, 1)} kg`)}
            ${field('target_weight_kg', 'Target weight', (v) => `${fmtNum(v, 1)} kg`)}${field('goal', 'Goal', (v) => label('goal', v))}${field('experience', 'Experience', (v) => label('experience', v))}
            ${field('workout_location', 'Trains at', (v) => label('location', v))}${field('diet_preference', 'Diet', (v) => label('diet', v))}${field('allergies', 'Allergies')}
            ${field('work_schedule', 'Work schedule')}${field('availability', 'Workout availability')}${field('biggest_challenge', 'Biggest challenge')}${field('medical_notes', 'Injuries or medical')}
            ${field('plan_interest', 'Plan interest')}${field('start_date', 'Wants to start', fmtDate)}${field('message', 'Message')}
            ${lead.utm ? html`<dt>Came from</dt><dd>${Object.entries(lead.utm).map(([k, v]) => `${k}: ${v}`).join(', ')}</dd>` : ''}
          </dl>
          ${lead.medical_notes ? html`<div class="notice warn" style="margin-top:14px"><span>Medical notes given. Check whether a doctor's clearance is needed before starting.</span></div>` : ''}
        </section>
        <section class="panel"><div class="panel-head"><h3>History</h3></div>
          <form class="cluster" data-note style="margin-bottom:14px"><input class="input" name="note" placeholder="Add a note, e.g. called, consult booked for Thursday" style="flex:1;min-height:42px" maxlength="2000" aria-label="Note"><button class="btn btn-ghost btn-sm" type="submit">Add note</button></form>
          ${events.length ? html`<ul class="timeline">${events.map((e) => html`<li>${e.kind === 'status_changed' ? html`Status: ${label('lead', e.from_status)} to <b>${label('lead', e.to_status)}</b>` : e.kind === 'created' ? 'Enquiry received' : e.kind === 'registered' ? 'Created a portal account' : e.kind === 'converted' ? html`<b>Converted to client</b>` : ''}${e.note ? html`${e.kind === 'note' ? '' : ': '}${e.note}` : ''}<span>${fmtDateTime(e.created_at)}${e.actor?.full_name ? ` · ${e.actor.full_name}` : ''}</span></li>`)}</ul>` : html`<p class="muted small">No history yet.</p>`}
        </section>
      </div>
      <div class="stack" style="--stack:16px">
        <section class="panel"><div class="panel-head"><h3>Manage</h3></div>
          <form class="form" data-manage>
            <div class="field"><label for="ld-status">Status</label><select class="input" id="ld-status" name="status">${Object.entries(LABELS.lead).map(([k, v]) => html`<option value="${k}" ${k === lead.status ? raw('selected') : ''}>${v}</option>`)}</select></div>
            <div class="field"><label for="ld-fu">Next follow-up</label><input class="input" id="ld-fu" name="next_follow_up" type="date" value="${lead.next_follow_up || ''}"></div>
            <div class="field"><label for="ld-notes">Private notes</label><textarea class="input" id="ld-notes" name="admin_notes" maxlength="4000">${lead.admin_notes || ''}</textarea></div>
            <button class="btn btn-ghost btn-sm" type="submit">Save</button>
          </form>
        </section>
        <section class="panel"><div class="panel-head"><h3>Convert to client</h3></div>
          ${lead.status === 'converted' ? html`<p class="small muted">Converted. ${account ? '' : 'Their account activates automatically when they register with this email.'}</p>` : html`
          <p class="small muted">${account ? 'Activates their existing portal account.' : `Pre-approves ${lead.email || 'their email'}, so their account is active as soon as they register.`}</p>
          <div class="field"><label for="cv-plan">Coaching plan</label><select class="input" id="cv-plan" data-plan><option value="">${lead.plan_interest || 'Choose later'}</option>${(settings.plans || []).map((p) => html`<option ${p.name === lead.plan_interest ? raw('selected') : ''}>${p.name}</option>`)}</select></div>
          <button class="btn btn-primary btn-sm" type="button" data-convert ${lead.email ? '' : raw('disabled')}>Convert to client</button>
          ${lead.email ? '' : html`<p class="small muted">Add an email address first.</p>`}`}
          ${!account && lead.status === 'converted' ? html`<p class="small" style="margin-top:10px">Send them: <a href="/portal/register/" target="_blank">${location.origin}/portal/register/</a></p>` : ''}
        </section>
        <section class="panel"><div class="panel-head"><h3>Edit contact details</h3></div>
          <form class="form" data-contact-form>
            <div class="field"><label for="lc-name">Name</label><input class="input" id="lc-name" name="name" value="${lead.name}" maxlength="100"></div>
            <div class="field"><label for="lc-email">Email</label><input class="input" id="lc-email" name="email" type="email" value="${lead.email || ''}"></div>
            <div class="field"><label for="lc-wa">WhatsApp</label><input class="input" id="lc-wa" name="whatsapp" value="${lead.whatsapp || ''}" maxlength="20"></div>
            <button class="btn btn-ghost btn-sm" type="submit">Save contact details</button>
          </form>
          <hr><button class="btn btn-quiet btn-sm" type="button" data-delete style="color:#F4A08D">Delete lead</button>
        </section>
      </div>
    </div>`);

  const reload = () => go(`lead/${id}`);
  $$('[data-contacted]').forEach((a) => a.addEventListener('click', async () => {
    if (lead.status === 'new') { await supa.from('leads').update({ status: 'contacted' }).eq('id', id); refreshCounts(); setTimeout(reload, 400); }
  }));
  $('[data-note]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = e.target.elements.note.value.trim(); if (!note) return;
    try { await q(supa.from('lead_events').insert({ lead_id: id, kind: 'note', note })); reload(); } catch (err) { toast(err.message, 'error'); }
  });
  $('[data-manage]').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    busy(e.target.querySelector('button'), async () => {
      try { await q(supa.from('leads').update({ status: f.status.value, next_follow_up: f.next_follow_up.value || null, admin_notes: f.admin_notes.value.trim() || null }).eq('id', id)); toast('Saved'); refreshCounts(); reload(); } catch (err) { toast(err.message, 'error'); }
    });
  });
  $('[data-contact-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const email = f.email.value.trim().toLowerCase();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Check the email address.', 'error'); return; }
    busy(e.target.querySelector('button'), async () => {
      try { await q(supa.from('leads').update({ name: f.name.value.trim() || lead.name, email: email || null, whatsapp: f.whatsapp.value.replace(/[^0-9+]/g, '') || null }).eq('id', id)); toast('Saved'); reload(); } catch (err) { toast(err.message, 'error'); }
    });
  });
  $('[data-convert]')?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    try {
      const { data, error } = await supa.rpc('convert_lead', { p_lead: id, p_plan: $('[data-plan]').value || null });
      if (error) throw new Error(error.message);
      toast(data.mode === 'activated' ? 'Client activated. They have been emailed.' : 'Pre-approved. Their account will be active when they register.');
      refreshCounts();
      if (data.profile_id) go(`client/${data.profile_id}`); else reload();
    } catch (err) { toast(err.message, 'error'); }
  }));
  $('[data-delete]').addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete this lead?', body: `${lead.name}'s enquiry and its history will be permanently deleted. Use this when someone asks for their data to be removed.` }))) return;
    try { await q(supa.from('leads').delete().eq('id', id)); toast('Lead deleted'); refreshCounts(); go('leads'); } catch (err) { toast(err.message, 'error'); }
  });
});
