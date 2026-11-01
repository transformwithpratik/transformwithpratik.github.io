// Coach dashboard shell, hash router and shared helpers.
import { supa, q } from '../lib/supabase.js';
import { requireUser, signOut } from '../lib/auth.js';
import { $, $$, html, raw, setHTML, timeAgo, safeUrl } from '../lib/util.js';
import { icon } from '../lib/icons.js';

export const NAV = [
  { key: 'overview', label: 'Overview', icon: 'home' },
  { key: 'leads', label: 'Leads', icon: 'inbox', count: 'leads_new' },
  { key: 'clients', label: 'Clients', icon: 'users', count: 'clients_pending' },
  { key: 'checkins', label: 'Check-ins', icon: 'calendar', count: 'checkins_pending' },
  { key: 'payments', label: 'Payments and renewals', icon: 'money', count: 'renewals_due' },
  { section: 'Content' },
  { key: 'recipes', label: 'Recipes', icon: 'food' },
  { key: 'exercises', label: 'Exercise library', icon: 'dumbbell' },
  { key: 'resources', label: 'Resources and PDFs', icon: 'book' },
  { key: 'transformations', label: 'Transformations', icon: 'photo' },
  { key: 'reviews', label: 'Reviews', icon: 'star', count: 'reviews_pending' },
  { section: 'Settings' },
  { key: 'settings', label: 'Site settings', icon: 'settings' },
  { key: 'emails', label: 'Email log', icon: 'mail', count: 'emails_failed' },
  { key: 'audit', label: 'Activity log', icon: 'shield', admin: true },
];

const brand = raw(`<a class="brand" href="/" aria-label="GetFitWithPratik website"><svg class="brand-mark" viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="9" fill="#242925"/><path d="M7 23.5l6-6.5 4.5 3.5L27 10" fill="none" stroke="#B8F36B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="27" cy="10" r="2.6" fill="#B8F36B"/></svg><span class="brand-name">GetFitWith<b>Pratik</b></span></a>`);

export const store = { ctx: null, stats: {} };

export async function mountAdmin() {
  document.body.classList.add('app', 'admin');
  const ctx = await requireUser('staff');
  if (!ctx) return null;
  store.ctx = ctx;
  const { profile } = ctx;
  const navItems = NAV.filter((n) => !n.admin || profile.role === 'admin');
  setHTML(document.body, html`
    <a class="skip" href="#content">Skip to content</a>
    <div class="shell">
      <aside class="app-side" aria-label="Coach navigation" data-side>
        ${brand}
        <ul class="side-nav">${navItems.map((n) => (n.section ? html`</ul><p class="side-section">${n.section}</p><ul class="side-nav">` : html`<li><a href="#${n.key}" data-nav="${n.key}">${raw(icon(n.icon))}${n.label}${n.count ? html`<span class="count" data-count="${n.count}" hidden></span>` : ''}</a></li>`))}</ul>
        <div class="side-foot">
          <a class="btn btn-quiet btn-sm btn-block" href="/portal/dashboard/" style="justify-content:flex-start">${raw(icon('user'))} Client portal view</a>
          <div class="side-user"><span class="avatar">${(profile.full_name || 'C')[0]}</span><div><b>${profile.full_name || 'Coach'}</b><span>${profile.role === 'admin' ? 'Admin' : 'Coach'}</span></div></div>
          <button class="btn btn-quiet btn-sm btn-block" type="button" data-signout style="justify-content:flex-start">${raw(icon('logout'))} Sign out</button>
        </div>
      </aside>
      <div class="app-main">
        <header class="app-top">
          <button class="icon-btn" type="button" data-menu style="display:none"><span class="sr-only">Menu</span>${raw(icon('menu'))}</button>
          ${brand}
          <h1 data-title>Overview</h1>
          <button class="icon-btn bell" type="button" data-bell aria-expanded="false"><span class="sr-only">Notifications</span>${raw(icon('bell'))}<span class="dot" data-bell-count hidden></span></button>
        </header>
        <div class="popover" data-notifs hidden></div>
        <main class="app-content" id="content" tabindex="-1" data-view></main>
      </div>
    </div>
    <div class="toasts" aria-live="polite" data-toasts></div>`);
  $('[data-signout]').addEventListener('click', signOut);
  const menuBtn = $('[data-menu]');
  const mq = window.matchMedia('(max-width: 1023px)');
  const syncMenu = () => { menuBtn.style.display = mq.matches ? 'inline-grid' : 'none'; };
  syncMenu(); mq.addEventListener('change', syncMenu);
  menuBtn.addEventListener('click', openMobileNav);
  initNotifs(ctx.user.id);
  refreshCounts();
  return ctx;
}

function openMobileNav() {
  const back = document.createElement('div'); back.className = 'sheet-backdrop';
  const sheet = document.createElement('div'); sheet.className = 'more-sheet'; sheet.style.maxHeight = '80vh'; sheet.style.overflowY = 'auto';
  sheet.innerHTML = String(html`<ul>${NAV.filter((n) => !n.section && (!n.admin || store.ctx.profile.role === 'admin')).map((n) => html`<li><a href="#${n.key}">${n.label}${n.count && store.stats[n.count] ? ` (${store.stats[n.count]})` : ''}</a></li>`)}<li><a href="/portal/dashboard/">Client portal view</a></li><li><button type="button" data-signout>Sign out</button></li></ul>`);
  const close = () => { back.remove(); sheet.remove(); };
  back.addEventListener('click', close);
  sheet.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  sheet.querySelector('[data-signout]').addEventListener('click', signOut);
  document.body.append(back, sheet);
}

export async function refreshCounts() {
  try {
    const { data } = await supa.rpc('admin_overview');
    store.stats = data || {};
    $$('[data-count]').forEach((el) => { const n = store.stats[el.dataset.count] || 0; el.hidden = !n; el.textContent = String(n); });
  } catch { /* counts are optional */ }
  return store.stats;
}

async function initNotifs(uid) {
  const bell = $('[data-bell]'); const pop = $('[data-notifs]'); const count = $('[data-bell-count]');
  let items = [];
  const load = async () => {
    const { data } = await supa.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(40);
    items = data || [];
    const unread = items.filter((n) => !n.read_at).length;
    count.hidden = !unread; count.textContent = unread > 9 ? '9+' : String(unread);
    setHTML(pop, html`<div class="popover-head"><b>Notifications</b>${unread ? html`<button class="link-btn small" type="button" data-read-all>Mark all read</button>` : ''}</div>
      ${items.length ? items.map((n) => html`<a class="notif ${n.read_at ? '' : 'unread'}" href="${safeUrl(n.link)?.replace(/^\/admin\/?/, '') || '#'}" data-id="${n.id}"><b>${n.title}</b>${n.body ? html`<span>${n.body}</span><br>` : ''}<span>${timeAgo(n.created_at)}</span></a>`) : html`<p class="muted small" style="padding:16px;margin:0">New enquiries, sign-ups, check-ins and reviews appear here.</p>`}`);
    $('[data-read-all]', pop)?.addEventListener('click', async () => { await supa.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', uid).is('read_at', null); load(); });
    $$('.notif', pop).forEach((a) => a.addEventListener('click', () => { pop.hidden = true; supa.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', a.dataset.id).then(load); }));
  };
  bell.addEventListener('click', () => { pop.hidden = !pop.hidden; bell.setAttribute('aria-expanded', String(!pop.hidden)); });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target) && !bell.contains(e.target)) pop.hidden = true; });
  await load();
  setInterval(() => { load(); refreshCounts(); }, 90000);
}

// Router: #view/arg1/arg2
const routes = {};
export const route = (name, fn) => { routes[name] = fn; };
export function go(hash) { if (location.hash === `#${hash}`) render(); else location.hash = hash; }

export async function render() {
  const [name = 'overview', ...args] = location.hash.slice(1).split('/').map(decodeURIComponent);
  const view = $('[data-view]');
  const fn = routes[name] || routes.overview;
  const navKey = { lead: 'leads', client: 'clients', recipe: 'recipes' }[name] || name;
  $$('[data-nav]').forEach((a) => (a.dataset.nav === navKey ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const item = NAV.find((n) => n.key === navKey);
  $('[data-title]').textContent = item?.label || 'Coach dashboard';
  document.title = `${item?.label || 'Coach dashboard'} | GetFitWithPratik`;
  setHTML(view, html`<div class="skeleton" style="height:36px;max-width:320px"></div><div class="skeleton" style="height:280px;margin-top:20px"></div>`);
  try {
    await fn(view, ...args);
  } catch (err) {
    console.error(err);
    setHTML(view, html`<div class="notice danger">${err.message || 'Something went wrong.'}</div>`);
  }
  view.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

export function start() {
  window.addEventListener('hashchange', render);
  render();
}

// Plain-language description of an audit_log row, e.g. "Updated a client profile".
const AUDIT_TABLES = { profiles: 'a client profile', leads: 'a lead', plans: 'daily targets', workout_plans: 'a training plan', nutrition_plans: 'a nutrition plan', payments: 'a payment', transformations: 'a transformation', feedback: 'a review', recipes: 'a recipe', resources: 'a resource', exercises: 'an exercise', site_settings: 'site settings', client_invites: 'a pre-approval' };
export const auditText = (a) => `${{ insert: 'Added', update: 'Updated', delete: 'Deleted' }[a.action] || a.action} ${AUDIT_TABLES[a.table_name] || a.table_name.replace(/_/g, ' ')}`;

export const statusTag = (status, text) => html`<span class="kanban-status"><span class="status-dot ${status}"></span>${text || status}</span>`;

// Generic helper for "click a row to open"
export function rowLinks(root) {
  $$('[data-href]', root).forEach((tr) => {
    tr.addEventListener('click', (e) => { if (!e.target.closest('a,button,input,select')) go(tr.dataset.href); });
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(tr.dataset.href); });
  });
}

export { q, supa };
