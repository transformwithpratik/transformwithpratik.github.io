// Static server that behaves like GitHub Pages (folder index pages, trailing-slash redirects,
// 404.html), plus the fake Supabase endpoints used by tests/e2e/fake-supabase.js.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createDB, parseOr, parseRestQuery } from './fake-db.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon' };

export function createFakeBackend(seed) {
  const state = structuredClone(seed);
  const db = createDB(state);
  const log = { storage: [], rpc: [], auth: [] };
  const shortName = (n) => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p.at(-1)[0]}.` : p[0] || 'Client'; };

  const rpc = {
    submit_lead({ p }) {
      if (p.website) return { ok: true };
      const e = {};
      if (!p.name || p.name.trim().length < 2) e.name = 'Enter your full name.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email || '')) e.email = 'Enter a valid email address.';
      const digits = String(p.whatsapp || '').replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) e.whatsapp = 'Enter a WhatsApp number with 10 to 15 digits, including country code if outside India.';
      if (!(p.age >= 16 && p.age <= 90)) e.age = 'Age must be between 16 and 90.';
      if (!(p.height_cm >= 120 && p.height_cm <= 230)) e.height_cm = 'Height must be between 120 and 230 cm.';
      if (!(p.weight_kg >= 30 && p.weight_kg <= 300)) e.weight_kg = 'Weight must be between 30 and 300 kg.';
      if (!['fat_loss', 'muscle_gain', 'recomposition', 'strength', 'general_fitness'].includes(p.goal)) e.goal = 'Choose a goal.';
      if (p.consent !== true) e.consent = 'Please agree so I can contact you about coaching.';
      if (Object.keys(e).length) return { ok: false, errors: e };
      const [row] = db.insert('leads', { ...p, email: p.email.toLowerCase(), source: 'website', status: 'new', updated_at: new Date().toISOString() });
      db.insert('email_outbox', { to_email: 'transformwithpratik@gmail.com', template: 'coach_new_lead', subject: `New enquiry: ${row.name}`, status: 'queued', attempts: 0, data: {} });
      return { ok: true, id: row.id };
    },
    submit_feedback({ p }, uid) {
      if (p.website) return { ok: true };
      const e = {};
      if (!(p.rating >= 1 && p.rating <= 5)) e.rating = 'Choose a rating from 1 to 5.';
      if ((p.feedback || '').trim().length < 10) e.feedback = 'Write at least a sentence (10 characters).';
      if (Object.keys(e).length) return { ok: false, errors: e };
      db.insert('feedback', { name: p.is_anonymous ? null : p.name || null, email: p.email || null, rating: p.rating, relationship: p.relationship || null, feedback: p.feedback.trim(), is_anonymous: !!p.is_anonymous, consent_public: !!p.consent_public, status: 'pending', featured: false, client_id: uid });
      return { ok: true };
    },
    get_public_reviews({ p_limit = 12 }) {
      return db.select({ table: 'feedback', filters: [{ col: 'status', op: 'eq', val: 'approved' }, { col: 'consent_public', op: 'eq', val: true }], order: [{ col: 'featured', ascending: false }, { col: 'created_at', ascending: false }], limit: p_limit }).rows
        .map((f) => ({ id: f.id, display_name: f.is_anonymous ? 'Anonymous' : f.display_name || shortName(f.name), rating: f.rating, relationship: f.relationship, body: f.feedback, created_at: f.created_at, featured: f.featured }));
    },
    admin_overview() {
      const prof = db.table('profiles').filter((p) => p.role === 'client');
      const leads = db.table('leads');
      return { leads_total: leads.length, leads_new: leads.filter((l) => l.status === 'new').length, leads_open: leads.filter((l) => ['new', 'contacted', 'consult_booked'].includes(l.status)).length, leads_this_month: leads.length, clients_active: prof.filter((p) => p.status === 'active').length, clients_pending: prof.filter((p) => p.status === 'pending').length, clients_completed: prof.filter((p) => p.status === 'completed').length, clients_inactive: prof.filter((p) => p.status === 'inactive').length, renewals_due: 1, plans_expired: 0, checkins_pending: db.table('weekly_checkins').filter((c) => c.status === 'pending_review').length, reviews_pending: db.table('feedback').filter((f) => f.status === 'pending').length, emails_queued: db.table('email_outbox').filter((m) => m.status === 'queued').length, emails_failed: db.table('email_outbox').filter((m) => m.status === 'failed').length, revenue_this_month: 0, revenue_last_month: 9999 };
    },
    convert_lead({ p_lead, p_plan }) {
      const l = db.table('leads').find((x) => x.id === p_lead);
      if (!l) throw new Error('Lead not found');
      l.status = 'converted';
      const existing = db.table('profiles').find((p) => p.email === l.email);
      if (existing) { existing.status = 'active'; existing.plan_name = p_plan; return { mode: 'activated', profile_id: existing.id, email: l.email }; }
      db.insert('client_invites', { email: l.email, full_name: l.name, plan_name: p_plan, lead_id: l.id });
      return { mode: 'invited', profile_id: null, email: l.email };
    },
    notify_client({ p_client, p_title, p_link }) { db.insert('notifications', { user_id: p_client, kind: 'coach', title: p_title, link: p_link }); return null; },
    admin_send_test_email() { db.insert('email_outbox', { to_email: 'transformwithpratik@gmail.com', template: 'test', subject: 'Test email', status: 'queued', attempts: 0, data: {} }); return null; },
  };

  function runQuery(b) {
    const filters = b.filters.map((f) => (f.op === 'or_raw' ? { op: 'or', val: parseOr(f.val) } : f));
    let rows;
    if (b.op === 'select') {
      const r = db.select({ table: b.table, filters, select: b.cols, order: b.order, limit: b.limit, offset: b.offset });
      if (b.countOpt?.head) return { data: null, count: r.total, error: null };
      rows = r.rows;
      if (b.mode === 'single') return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: `JSON object requested, multiple (or no) rows returned`, code: 'PGRST116' } };
      if (b.mode === 'maybe') return rows.length > 1 ? { data: null, error: { message: 'multiple rows' } } : { data: rows[0] || null, error: null };
      return { data: rows, error: null, count: b.countOpt?.count ? r.total : null };
    }
    if (b.op === 'insert') rows = db.insert(b.table, b.payload, b.uid);
    else if (b.op === 'update') rows = db.update(b.table, filters, b.payload);
    else if (b.op === 'upsert') rows = db.upsert(b.table, b.payload, b.onConflict, b.uid);
    else if (b.op === 'delete') rows = db.remove(b.table, filters);
    if (!b.want) return { data: null, error: null };
    const sel = b.retCols || '*';
    rows = rows.map((r) => db.select({ table: b.table, filters: [{ col: 'id', op: 'eq', val: r.id }], select: sel }).rows[0] || r);
    if (b.mode === 'single') return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
    if (b.mode === 'maybe') return { data: rows[0] || null, error: null };
    return { data: rows, error: null };
  }

  function auth(b) {
    log.auth.push(b);
    if (b.action === 'signin') {
      const u = state.users.find((x) => x.email === b.email && x.password === b.password);
      if (!u) return { error: { message: 'Invalid login credentials' } };
      return { user: { id: u.id, email: u.email, app_metadata: { providers: ['email'] }, user_metadata: {}, created_at: '2026-07-01T00:00:00Z' } };
    }
    if (b.action === 'signup') {
      if (state.users.some((u) => u.email === b.email)) return { user: { id: 'x', email: b.email, identities: [] } };
      const id = crypto.randomUUID();
      state.users.push({ id, email: b.email, password: b.password });
      const invite = db.table('client_invites').find((i) => i.email === b.email && !i.used_at);
      db.insert('profiles', { id, email: b.email, full_name: b.full_name || null, role: 'client', status: invite ? 'active' : 'pending', plan_name: invite?.plan_name || null, checkin_day: 0, email_notifications: true });
      return { user: { id, email: b.email, identities: [{ id }] } };
    }
    return {};
  }

  return {
    state, db, log, rpc,
    handle(kind, body) {
      try {
        if (kind === 'db') return runQuery(body);
        if (kind === 'rpc') {
          log.rpc.push(body);
          const fn = rpc[body.name];
          return fn ? { data: fn(body.args || {}, body.uid), error: null } : { data: null, error: { message: `Could not find the function public.${body.name}` } };
        }
        if (kind === 'auth') return auth(body);
        if (kind === 'storage') { log.storage.push(body); return { ok: true }; }
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
      return { error: { message: 'unknown' } };
    },
    rest(method, path, search, body) {
      if (path.startsWith('rpc/')) {
        const fn = rpc[path.slice(4)];
        return fn ? fn(body || {}, null) : null;
      }
      const qy = parseRestQuery(path, search);
      // Mirror the anonymous-role row level security for the public tables we read over REST.
      const anon = { recipes: (r) => r.is_published, exercises: (r) => r.is_published, resources: (r) => r.is_published && r.access === 'public', transformations: (r) => r.status === 'published' && r.consent_confirmed, site_settings: (r) => r.key !== 'notifications' };
      if (!anon[path]) return [];
      const pk = path === 'site_settings' ? 'key' : 'id';
      const visible = db.table(path).filter(anon[path]).map((r) => r[pk]);
      return db.select({ ...qy, filters: [...qy.filters, { col: pk, op: 'in', val: visible }] }).rows;
    },
  };
}

export function startServer(root, backend, port = 0) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/__fake/')) {
      let raw = '';
      for await (const c of req) raw += c;
      const out = backend.handle(url.pathname.slice(8), JSON.parse(raw || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
      return;
    }
    let p = decodeURIComponent(url.pathname);
    if (p === '/tests/e2e/pixel.png') p = '/assets/og-default.png';
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    const send = async (f, status = 200) => {
      const body = await readFile(f);
      res.writeHead(status, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    };
    try {
      const s = await stat(file);
      if (s.isDirectory()) {
        if (!p.endsWith('/')) { res.writeHead(301, { Location: `${p}/${url.search}` }); res.end(); return; }
        await send(join(file, 'index.html'));
        return;
      }
      await send(file);
    } catch {
      try { const s = await stat(`${file}.html`); if (s.isFile()) { await send(`${file}.html`); return; } } catch { /* fall through */ }
      await send(join(root, '404.html'), 404);
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
