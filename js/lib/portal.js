// Client portal shell: sidebar on desktop, tab bar on mobile, notifications, sign-out.
import { supa } from './supabase.js';
import { requireUser, signOut, isStaff } from './auth.js';
import { $, $$, html, raw, setHTML, timeAgo, safeUrl } from './util.js';
import { icon } from './icons.js';

const NAV = [
  { key: 'dashboard', href: '/portal/dashboard/', label: 'Dashboard', icon: 'home' },
  { key: 'logs', href: '/portal/logs/', label: 'Food and workouts', icon: 'log' },
  { key: 'progress', href: '/portal/progress/', label: 'Progress', icon: 'chart' },
  { key: 'checkins', href: '/portal/checkins/', label: 'Weekly check-in', icon: 'calendar' },
  { key: 'plan', href: '/portal/plan/', label: 'My plan', icon: 'plan' },
  { key: 'library', href: '/portal/library/', label: 'Library', icon: 'book' },
  { key: 'profile', href: '/portal/profile/', label: 'Profile', icon: 'user' },
];
const TABBAR = ['dashboard', 'logs', 'checkins', 'progress'];

const brand = raw(`<a class="brand" href="/" aria-label="GetFitWithPratik website"><svg class="brand-mark" viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="9" fill="#242925"/><path d="M7 23.5l6-6.5 4.5 3.5L27 10" fill="none" stroke="#B8F36B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="27" cy="10" r="2.6" fill="#B8F36B"/></svg><span class="brand-name">GetFitWith<b>Pratik</b></span></a>`);

export async function mountPortal({ active, title, mode = 'client' }) {
  document.body.classList.add('app');
  const ctx = await requireUser(mode);
  if (!ctx) return null;
  const { profile } = ctx;
  const initial = (profile.full_name || profile.email || '?').trim()[0].toUpperCase();

  setHTML(document.body, html`
    <a class="skip" href="#content">Skip to content</a>
    <div class="shell">
      <aside class="app-side" aria-label="Portal navigation">
        ${brand}
        <ul class="side-nav">
          ${NAV.map((n) => html`<li><a href="${n.href}" ${n.key === active ? raw('aria-current="page"') : ''}>${raw(icon(n.icon))}${n.label}</a></li>`)}
        </ul>
        ${isStaff(profile) ? html`<p class="side-section">Coach</p><ul class="side-nav"><li><a href="/admin/">${raw(icon('shield'))}Coach dashboard</a></li></ul>` : ''}
        <div class="side-foot">
          <div class="side-user"><span class="avatar">${initial}</span><div><b>${profile.full_name || 'Client'}</b><span>${profile.email || ''}</span></div></div>
          <button class="btn btn-quiet btn-sm btn-block" type="button" data-signout style="justify-content:flex-start">${raw(icon('logout'))} Sign out</button>
        </div>
      </aside>
      <div class="app-main">
        <header class="app-top">
          ${brand}
          <h1>${title}</h1>
          <button class="icon-btn bell" type="button" data-bell aria-haspopup="true" aria-expanded="false"><span class="sr-only">Notifications</span>${raw(icon('bell'))}<span class="dot" data-bell-count hidden></span></button>
        </header>
        <div class="popover" data-notifs hidden></div>
        <main class="app-content" id="content" data-content tabindex="-1">
          <div class="skeleton" style="height:36px;max-width:320px"></div>
          <div class="stats" style="margin-top:20px"><div class="skeleton" style="height:104px"></div><div class="skeleton" style="height:104px"></div><div class="skeleton" style="height:104px"></div></div>
        </main>
      </div>
    </div>
    <nav class="tabbar" aria-label="Portal">
      ${TABBAR.map((k) => { const n = NAV.find((x) => x.key === k); return html`<a href="${n.href}" ${k === active ? raw('aria-current="page"') : ''}>${raw(icon(n.icon))}<span>${k === 'logs' ? 'Log' : k === 'checkins' ? 'Check-in' : n.label.split(' ')[0]}</span></a>`; })}
      <button type="button" data-more ${['plan', 'library', 'profile'].includes(active) ? raw('aria-current="page"') : ''}>${raw(icon('more'))}<span>More</span></button>
    </nav>
    <div class="toasts" aria-live="polite" data-toasts></div>
  `);

  $$('[data-signout]').forEach((b) => b.addEventListener('click', signOut));
  $('[data-more]').addEventListener('click', openMore);
  initNotifications(ctx.user.id);
  return { ...ctx, content: $('[data-content]') };
}

function openMore() {
  const back = document.createElement('div'); back.className = 'sheet-backdrop';
  const sheet = document.createElement('div'); sheet.className = 'more-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'More');
  sheet.innerHTML = String(html`<ul>
    <li><a href="/portal/plan/">My plan</a></li>
    <li><a href="/portal/library/">Library</a></li>
    <li><a href="/portal/profile/">Profile</a></li>
    <li><a href="/">Website</a></li>
    <li><button type="button" data-signout>Sign out</button></li>
  </ul>`);
  const close = () => { back.remove(); sheet.remove(); };
  back.addEventListener('click', close);
  sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  sheet.querySelector('[data-signout]').addEventListener('click', signOut);
  document.body.append(back, sheet);
  sheet.querySelector('a').focus();
}

async function initNotifications(userId) {
  const bell = $('[data-bell]'); const pop = $('[data-notifs]'); const count = $('[data-bell-count]');
  let items = [];
  async function load() {
    const { data } = await supa.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
    items = data || [];
    const unread = items.filter((n) => !n.read_at).length;
    count.hidden = unread === 0; count.textContent = unread > 9 ? '9+' : String(unread);
    render();
  }
  function render() {
    setHTML(pop, html`<div class="popover-head"><b>Notifications</b>${items.some((n) => !n.read_at) ? html`<button class="link-btn small" type="button" data-read-all>Mark all read</button>` : ''}</div>
      ${items.length ? items.map((n) => html`<a class="notif ${n.read_at ? '' : 'unread'}" href="${safeUrl(n.link) || '#'}" data-id="${n.id}"><b>${n.title}</b>${n.body ? html`<span>${n.body}</span><br>` : ''}<span>${timeAgo(n.created_at)}</span></a>`)
    : html`<p class="muted small" style="padding:16px;margin:0">No notifications yet. Plan updates, coach feedback and reminders appear here.</p>`}`);
    $('[data-read-all]', pop)?.addEventListener('click', async () => {
      await supa.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
      load();
    });
    $$('.notif', pop).forEach((a) => a.addEventListener('click', () => {
      supa.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', a.dataset.id).then(() => {});
    }));
  }
  bell.addEventListener('click', () => {
    pop.hidden = !pop.hidden;
    bell.setAttribute('aria-expanded', String(!pop.hidden));
  });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target) && !bell.contains(e.target)) { pop.hidden = true; bell.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { pop.hidden = true; bell.focus(); } });
  await load();
  setInterval(load, 120000);
  return { reload: load, items: () => items };
}

// Loads the client's active targets and structured plans together.
export async function loadPlans(clientId) {
  const [targets, workout, nutrition] = await Promise.all([
    supa.from('plans').select('*').eq('client_id', clientId).eq('is_active', true).maybeSingle(),
    supa.from('workout_plans').select('*').eq('client_id', clientId).eq('is_active', true).maybeSingle(),
    supa.from('nutrition_plans').select('*').eq('client_id', clientId).eq('is_active', true).maybeSingle(),
  ]);
  return { targets: targets.data || null, workout: workout.data || null, nutrition: nutrition.data || null };
}

// Small modal helper for forms. Returns { dialog, form, close }.
export function openModal({ title, body, submit = 'Save', wide = false, onSubmit, danger }) {
  const d = document.createElement('dialog');
  d.className = `modal ${wide ? 'wide' : ''}`;
  d.innerHTML = String(html`<form method="dialog" novalidate>
    <div class="modal-head"><h2>${title}</h2><button class="icon-btn" type="button" data-close><span class="sr-only">Close</span>${raw(icon('x'))}</button></div>
    <div class="modal-body form">${body}<p class="field-error" data-error-for="form" role="alert"></p></div>
    <div class="modal-foot">
      ${danger ? html`<button class="btn btn-danger btn-sm" type="button" data-danger style="margin-right:auto">${danger}</button>` : ''}
      <button class="btn btn-ghost btn-sm" type="button" data-close>Cancel</button>
      ${submit ? html`<button class="btn btn-primary btn-sm" type="submit" data-submit>${submit}</button>` : ''}
    </div></form>`);
  (document.querySelector('.app') || document.body).appendChild(d);
  const form = d.querySelector('form');
  const close = () => { d.close(); d.remove(); };
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) { close(); return; }
    const btn = form.querySelector('[data-submit]');
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
    try {
      const ok = await onSubmit(form, d);
      if (ok !== false) close();
    } catch (err) {
      const slot = form.querySelector('[data-error-for="form"]');
      if (slot) slot.textContent = err.message || 'Something went wrong.';
    } finally { btn.removeAttribute('aria-busy'); btn.disabled = false; }
  });
  d.showModal();
  const first = form.querySelector('.modal-body input:not([type="hidden"]), .modal-body select, .modal-body textarea');
  first?.focus();
  return { dialog: d, form, close };
}
