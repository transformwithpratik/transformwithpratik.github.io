import { route, refreshCounts, rowLinks, statusTag, auditText, q, supa } from './shell.js';
import { html, setHTML, fmtNum, fmtDate, fmtMoney, timeAgo, label, ymd, addDays } from '../lib/util.js';
import { barChart } from '../lib/charts.js';

route('overview', async (view) => {
  const stats = await refreshCounts();
  const today = ymd();
  const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1);
  const [leads, pending, checkins, renewals, recent, allLeads] = await Promise.all([
    q(supa.from('leads').select('id,name,goal,status,created_at,plan_interest').in('status', ['new', 'contacted', 'consult_booked']).order('created_at', { ascending: false }).limit(6)),
    q(supa.from('profiles').select('id,full_name,email,created_at,lead_id').eq('role', 'client').eq('status', 'pending').order('created_at', { ascending: false }).limit(6)),
    q(supa.from('weekly_checkins').select('id,client_id,week_of,submitted_at,weight_kg,profiles!weekly_checkins_client_id_fkey(full_name)').eq('status', 'pending_review').order('submitted_at').limit(6)),
    q(supa.from('profiles').select('id,full_name,plan_name,plan_end').eq('role', 'client').eq('status', 'active').not('plan_end', 'is', null).lte('plan_end', addDays(today, 14)).order('plan_end').limit(6)),
    q(supa.from('audit_log').select('*').order('at', { ascending: false }).limit(8)).catch(() => []),
    q(supa.from('leads').select('created_at,status,goal,source').gte('created_at', since.toISOString())),
  ]);
  const months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)); }
  const byMonth = months.map((m) => ({ x: `${m}-01`, y: allLeads.filter((l) => l.created_at.slice(0, 7) === m).length }));
  const converted = allLeads.filter((l) => l.status === 'converted').length;
  const goals = Object.entries(allLeads.reduce((a, l) => { a[l.goal || 'unknown'] = (a[l.goal || 'unknown'] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);

  setHTML(view, html`
    <div class="page-intro"><div><h2>Overview</h2><p>${fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div></div>
    <div class="stats">
      <a class="stat" href="#leads"><span class="stat-label">Total leads</span><span class="stat-value">${fmtNum(stats.leads_total || 0)}</span><span class="stat-sub">${stats.leads_this_month || 0} this month</span></a>
      <a class="stat ${stats.leads_new ? 'accent' : ''}" href="#leads/new"><span class="stat-label">New leads</span><span class="stat-value">${stats.leads_new || 0}</span><span class="stat-sub">${stats.leads_open || 0} open in total</span></a>
      <a class="stat" href="#clients/active"><span class="stat-label">Active clients</span><span class="stat-value">${stats.clients_active || 0}</span><span class="stat-sub">${stats.clients_pending || 0} waiting for approval</span></a>
      <a class="stat" href="#clients/completed"><span class="stat-label">Completed</span><span class="stat-value">${stats.clients_completed || 0}</span><span class="stat-sub">${stats.clients_inactive || 0} inactive</span></a>
      <a class="stat" href="#payments"><span class="stat-label">Renewals due</span><span class="stat-value">${stats.renewals_due || 0}</span><span class="stat-sub">${stats.plans_expired || 0} past end date</span></a>
      <a class="stat ${stats.checkins_pending ? 'accent' : ''}" href="#checkins"><span class="stat-label">Check-ins to review</span><span class="stat-value">${stats.checkins_pending || 0}</span><span class="stat-sub">${stats.reviews_pending || 0} ${stats.reviews_pending === 1 ? 'review' : 'reviews'} to moderate</span></a>
      <a class="stat" href="#payments"><span class="stat-label">Revenue this month</span><span class="stat-value" style="font-size:1.4rem">${fmtMoney(stats.revenue_this_month || 0)}</span><span class="stat-sub">${fmtMoney(stats.revenue_last_month || 0)} last month</span></a>
      ${stats.emails_failed ? html`<a class="stat" href="#emails" style="border-color:#5E2E24"><span class="stat-label">Emails failed</span><span class="stat-value">${stats.emails_failed}</span><span class="stat-sub">Check email settings</span></a>` : ''}
    </div>
    <div class="panel-grid even">
      <section class="panel"><div class="panel-head"><h3>Open leads</h3><a class="small" href="#leads">All leads</a></div>
        ${leads.length ? html`<div class="rows">${leads.map((l) => html`<a class="row" href="#lead/${l.id}" style="text-decoration:none"><div class="grow"><b>${l.name}</b><span>${label('goal', l.goal) || 'No goal given'} · ${timeAgo(l.created_at)}</span></div>${statusTag(l.status, label('lead', l.status))}</a>`)}</div>` : html`<p class="muted small">No open leads. New enquiries from the website appear here.</p>`}</section>
      <section class="panel"><div class="panel-head"><h3>Waiting for approval</h3><a class="small" href="#clients/pending">All</a></div>
        ${pending.length ? html`<div class="rows">${pending.map((p) => html`<a class="row" href="#client/${p.id}" style="text-decoration:none"><div class="grow"><b>${p.full_name || p.email}</b><span>${p.email} · signed up ${timeAgo(p.created_at)}${p.lead_id ? ' · has enquiry' : ''}</span></div><span class="btn btn-primary btn-sm">Review</span></a>`)}</div>` : html`<p class="muted small">No accounts waiting.</p>`}</section>
      <section class="panel"><div class="panel-head"><h3>Check-ins to review</h3><a class="small" href="#checkins">All</a></div>
        ${checkins.length ? html`<div class="rows">${checkins.map((c) => html`<a class="row" href="#client/${c.client_id}/checkins" style="text-decoration:none"><div class="grow"><b>${c.profiles?.full_name || 'Client'}</b><span>Week of ${fmtDate(c.week_of, { day: 'numeric', month: 'short' })} · ${timeAgo(c.submitted_at)}</span></div><span class="num">${c.weight_kg ? `${fmtNum(c.weight_kg, 1)} kg` : ''}</span></a>`)}</div>` : html`<p class="muted small">All caught up.</p>`}</section>
      <section class="panel"><div class="panel-head"><h3>Renewals in the next 14 days</h3><a class="small" href="#payments">Payments</a></div>
        ${renewals.length ? html`<div class="rows">${renewals.map((r) => html`<a class="row" href="#client/${r.id}/payments" style="text-decoration:none"><div class="grow"><b>${r.full_name}</b><span>${r.plan_name || 'Plan'} ends ${fmtDate(r.plan_end)}</span></div>${r.plan_end < today ? statusTag('failed', 'Ended') : ''}</a>`)}</div>` : html`<p class="muted small">No plans ending soon. Record payments with a period end date to track renewals.</p>`}</section>
    </div>
    <div class="panel-grid" style="margin-top:16px">
      <section class="panel"><div class="panel-head"><h3>Leads per month</h3><span class="small muted">${allLeads.length ? `${Math.round((converted / allLeads.length) * 100)}% converted in this period` : ''}</span></div><div data-leads-chart></div></section>
      <section class="panel"><div class="panel-head"><h3>What leads want</h3></div>
        ${goals.length ? html`<ul class="kv">${goals.map(([g, n]) => html`<li><span>${label('goal', g) || 'Not given'}</span><span>${n}</span></li>`)}</ul>` : html`<p class="muted small">No data yet.</p>`}
        ${recent.length ? html`<h4 style="margin:20px 0 8px;font-size:1rem">Recent changes</h4><ul class="timeline">${recent.map((a) => html`<li>${auditText(a)}<span>${timeAgo(a.at)}</span></li>`)}</ul>` : ''}
      </section>
    </div>`);
  barChart(view.querySelector('[data-leads-chart]'), byMonth, { label: 'Leads per month', emptyText: 'No leads in the last 6 months.', integer: true, xFormat: { month: 'short' } });
  rowLinks(view);
});
void statusTag;
