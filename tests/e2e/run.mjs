// Browser tests: every page at phone and desktop width, plus the main user flows.
// Usage: node tests/e2e/run.mjs [screenshot-dir]
// Uses the preinstalled Chromium through Playwright and a fake Supabase backend (see fake-db.mjs).
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFakeBackend, startServer } from './server.mjs';
import { buildSeed, ADMIN, CLIENT, PENDING } from './seed.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const shots = process.argv[2] || join(here, 'screenshots');
const only = process.env.ONLY || '';
await mkdir(shots, { recursive: true });

const settings = JSON.parse(await readFile(join(here, 'settings.json'), 'utf8'));
const backend = createFakeBackend(buildSeed(settings));
const server = await startServer(root, backend);
const BASE = `http://127.0.0.1:${server.address().port}`;
const fakeClient = await readFile(join(here, 'fake-supabase.js'), 'utf8');

const browser = await chromium.launch();
const failures = [];
const notes = [];
const fail = (where, msg) => { failures.push(`${where}: ${msg}`); };

async function newContext(width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
  await ctx.route((u) => u.hostname !== '127.0.0.1', (r) => r.abort());
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fakeClient }));
  await ctx.route('https://trerqtscrsrlcfsnfetn.supabase.co/**', async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => r.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (url.pathname.startsWith('/rest/v1/')) {
      const body = req.postData() ? JSON.parse(req.postData()) : null;
      try { return json(backend.rest(req.method(), url.pathname.slice(9), url.search, body)); } catch (e) { return json({ message: e.message }, 400); }
    }
    if (url.pathname === '/auth/v1/settings') return json({ external: { google: false, email: true }, disable_signup: false, mailer_autoconfirm: false });
    if (url.pathname === '/functions/v1/send-email') return json(req.method() === 'GET' ? { provider: null } : { processed: 0 });
    if (url.pathname === '/functions/v1/delete-account') return json({ ok: true });
    if (url.pathname.startsWith('/storage/v1/object/public/')) return r.fulfill({ status: 200, contentType: 'image/png', body: await readFile(join(root, 'assets/og-default.png')) });
    return json({ message: 'not faked' }, 404);
  });
  return ctx;
}

function watch(page, label) {
  const issues = [];
  page.on('console', (m) => { if (m.type() === 'error') issues.push(`console: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => issues.push(`pageerror: ${e.message}`));
  page.on('response', (res) => {
    const u = new URL(res.url());
    if (u.hostname === '127.0.0.1' && res.status() >= 400 && !page.__expect404) issues.push(`HTTP ${res.status()} ${u.pathname}`);
  });
  page.__issues = issues;
  page.__label = label;
  return issues;
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(250);
}

async function checkLayout(page, where) {
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const over = document.documentElement.scrollWidth - vw;
    const offenders = [];
    if (over > 1) {
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.right > vw + 1 && b.width > 0 && getComputedStyle(el).position !== 'fixed') {
          let hidden = false;
          for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { hidden = true; break; } }
          const path = []; for (let p = el; p && p !== document.body && path.length < 4; p = p.parentElement) path.unshift(`${p.tagName.toLowerCase()}${p.classList.length ? `.${[...p.classList].join('.')}` : ''}`);
          if (!hidden) offenders.push(`${path.join(' > ')} right=${Math.round(b.right)} w=${Math.round(b.width)}`);
        }
        if (offenders.length > 4) break;
      }
    }
    const h1 = [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length;
    const skel = document.querySelectorAll('.skeleton').length;
    const dangers = [...document.querySelectorAll('.notice.danger')].map((n) => n.textContent.trim().slice(0, 160));
    const imgsNoAlt = [...document.querySelectorAll('img:not([alt])')].length;
    const unlabeled = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea')].filter((el) => {
      if (el.closest('[hidden]') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label')) return false;
      return !(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
    }).map((el) => el.name || el.id || el.outerHTML.slice(0, 80));
    return { over, offenders, h1, skel, dangers, imgsNoAlt, unlabeled, title: document.title };
  });
  if (r.over > 1) fail(where, `horizontal overflow ${r.over}px: ${r.offenders.join(', ')}`);
  if (r.h1 !== 1) notes.push(`${where}: ${r.h1} h1 elements`);
  if (r.skel) fail(where, `${r.skel} loading skeletons still visible`);
  if (r.dangers.length) fail(where, `error notice: ${r.dangers.join(' | ')}`);
  if (r.imgsNoAlt) fail(where, `${r.imgsNoAlt} images without alt`);
  if (r.unlabeled.length) fail(where, `unlabeled fields: ${r.unlabeled.slice(0, 6).join(', ')}`);
  return r;
}

const slug = (s) => s.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home';

async function visit(page, path, { width, expect404 = false, shot = true, name } = {}) {
  page.__expect404 = expect404;
  const issues = page.__issues;
  const before = issues.length;
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await settle(page);
  const where = `[${width}] ${path}`;
  await checkLayout(page, where);
  for (const i of issues.slice(before)) if (!(expect404 && /404/.test(i))) fail(where, i);
  if (shot) await page.screenshot({ path: join(shots, `${width}-${name || slug(path)}.png`), fullPage: true });
  page.__expect404 = false;
  return page.url();
}

async function login(page, user) {
  await page.goto(`${BASE}/portal/login/`);
  await settle(page);
  await page.fill('#email, input[name=email]', user.email);
  await page.fill('#password, input[name=password]', user.password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/portal/login'), { timeout: 8000 }).catch(() => {}), page.click('form button[type=submit]')]);
  await settle(page);
}

const PUBLIC = ['/', '/transformations/', '/transformations/story/?slug=test-fat-loss', '/calculator/', '/book/', '/feedback/', '/nutrition/', '/nutrition/recipes/paneer-bhurji/', '/nutrition/recipe-book/', '/workouts/', '/library/', '/library/nutrition-fundamentals/', '/library/weekly-grocery-list/', '/about/', '/contact/', '/privacy/', '/portal/login/', '/portal/register/', '/portal/forgot/'];
const PORTAL = ['/portal/dashboard/', '/portal/logs/', '/portal/progress/', '/portal/checkins/', '/portal/plan/', '/portal/library/', '/portal/profile/'];
const ADMIN_VIEWS = ['overview', 'leads', 'lead/ld1', 'clients', `client/${CLIENT.id}/overview`, `client/${CLIENT.id}/plan`, `client/${CLIENT.id}/checkins`, `client/${CLIENT.id}/food`, `client/${CLIENT.id}/workouts`, `client/${CLIENT.id}/progress`, `client/${CLIENT.id}/files`, `client/${CLIENT.id}/notes`, `client/${CLIENT.id}/payments`, `client/${CLIENT.id}/profile`, 'checkins', 'payments', 'recipes', 'exercises', 'resources', 'transformations', 'reviews', 'settings', 'emails', 'audit'];

async function suite(name, fn) {
  if (only && !name.includes(only)) return;
  const t = Date.now();
  try { await fn(); } catch (e) { fail(name, `threw: ${e.stack?.split('\n').slice(0, 3).join(' ')}`); }
  console.log(`${name} (${Date.now() - t} ms)`);
}

for (const width of [390, 1280]) {
  await suite(`public pages ${width}`, async () => {
    const ctx = await newContext(width);
    const page = await ctx.newPage();
    watch(page);
    for (const p of PUBLIC) await visit(page, p, { width });
    // Unknown and legacy URLs
    let url = await visit(page, '/nope-not-here/', { width, expect404: true, name: '404' });
    if (!/nope-not-here/.test(url)) fail(`[${width}] 404`, `unexpected redirect to ${url}`);
    url = await visit(page, '/transformations/test-muscle/', { width, expect404: true, shot: false });
    if (!/story\/\?slug=test-muscle/.test(url)) fail(`[${width}] transformation clean URL`, `ended at ${url}`);
    url = await visit(page, '/nutrition/recipes/not-prerendered/', { width, expect404: true, shot: false });
    if (!/recipe\/\?slug=not-prerendered/.test(url)) fail(`[${width}] recipe fallback`, `ended at ${url}`);
    for (const [from, to] of [['/pages/book.html', '/book/'], ['/portal/login.html', '/portal/login/'], ['/pages/admin.html', '/portal/login/'], ['/calculator', '/calculator/']]) {
      await page.goto(BASE + from); await settle(page);
      if (new URL(page.url()).pathname !== to) fail(`[${width}] redirect ${from}`, `ended at ${new URL(page.url()).pathname}, expected ${to}`);
    }
    await ctx.close();
  });
}

for (const width of [390, 1280]) {
  await suite(`client portal ${width}`, async () => {
    const ctx = await newContext(width);
    const page = await ctx.newPage();
    watch(page);
    await page.goto(`${BASE}/portal/dashboard/`); await settle(page);
    if (!new URL(page.url()).pathname.startsWith('/portal/login')) fail(`[${width}] guard`, `signed-out dashboard went to ${page.url()}`);
    await login(page, CLIENT);
    if (new URL(page.url()).pathname !== '/portal/dashboard/') fail(`[${width}] client login`, `landed on ${page.url()}`);
    for (const p of PORTAL) await visit(page, p, { width, name: `client-${slug(p)}` });
    await page.goto(`${BASE}/admin/`); await settle(page);
    if (new URL(page.url()).pathname.startsWith('/admin')) fail(`[${width}] admin guard`, 'client could open /admin/');
    await ctx.close();
  });
}

await suite('pending account', async () => {
  const ctx = await newContext(390);
  const page = await ctx.newPage();
  watch(page);
  await login(page, PENDING);
  if (new URL(page.url()).pathname !== '/portal/pending/') fail('pending login', `landed on ${page.url()}`);
  await visit(page, '/portal/pending/', { width: 390, name: 'pending' });
  await page.goto(`${BASE}/portal/logs/`); await settle(page);
  if (new URL(page.url()).pathname !== '/portal/pending/') fail('pending guard', `could open logs: ${page.url()}`);
  await ctx.close();
});

for (const width of [390, 1280]) {
  await suite(`admin ${width}`, async () => {
    const ctx = await newContext(width);
    const page = await ctx.newPage();
    watch(page);
    await login(page, ADMIN);
    if (new URL(page.url()).pathname !== '/admin/') fail(`[${width}] admin login`, `landed on ${page.url()}`);
    for (const v of ADMIN_VIEWS) {
      const before = page.__issues.length;
      await page.goto(`${BASE}/admin/#${v}`); await settle(page);
      const where = `[${width}] admin #${v}`;
      await checkLayout(page, where);
      for (const i of page.__issues.slice(before)) fail(where, i);
      await page.screenshot({ path: join(shots, `${width}-admin-${slug(v)}.png`), fullPage: true });
    }
    await ctx.close();
  });
}

const flows = await import('./flows.mjs').catch((e) => { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; return null; });
if (flows) await flows.default({ suite, newContext, watch, settle, visit, login, checkLayout, fail, BASE, backend, shots, ADMIN, CLIENT, PENDING });

await browser.close();
server.close();
console.log(`\n${notes.length ? `Notes:\n  ${notes.join('\n  ')}\n` : ''}`);
if (failures.length) {
  console.log(`${failures.length} failures:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('All browser checks passed.');
