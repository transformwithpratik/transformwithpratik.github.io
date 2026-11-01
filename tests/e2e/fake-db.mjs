// In-memory stand-in for the parts of Supabase (PostgREST) the site uses. Test-only.
// Row level security is NOT simulated here; the access rules are tested in SQL against the real project.
const NOW = () => new Date().toISOString();
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
const NO_UUID = new Set(['site_settings', 'favorites']);
const SERIAL = new Set(['email_outbox', 'audit_log']);

function splitTop(s) {
  const out = []; let depth = 0; let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function cast(v) {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}
const cmp = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1; if (b == null) return -1;
  const na = Number(a); const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && typeof a !== 'boolean' && String(a).trim() !== '' && !/^\d{4}-\d{2}-\d{2}/.test(String(a))) return na - nb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
};

export function matches(row, f) {
  const v = row[f.col];
  switch (f.op) {
    case 'eq': return String(v) === String(f.val);
    case 'neq': return String(v) !== String(f.val);
    case 'gt': return v != null && cmp(v, f.val) > 0;
    case 'gte': return v != null && cmp(v, f.val) >= 0;
    case 'lt': return v != null && cmp(v, f.val) < 0;
    case 'lte': return v != null && cmp(v, f.val) <= 0;
    case 'in': return f.val.map(String).includes(String(v));
    case 'is': return f.val === null ? v == null : v === f.val;
    case 'ilike': case 'like': {
      const re = new RegExp(`^${String(f.val).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, f.op === 'ilike' ? 'i' : '');
      return re.test(String(v ?? ''));
    }
    case 'cs': return Array.isArray(v) && f.val.every((x) => v.includes(x));
    case 'not': return !matches(row, { col: f.col, op: f.inner, val: f.val });
    case 'or': return f.val.some((g) => matches(row, g));
    default: throw new Error(`fake-db: unsupported filter ${f.op}`);
  }
}

export function parseOr(s) {
  return splitTop(s).map((part) => { const [col, op, ...rest] = part.split('.'); return { col, op, val: cast(rest.join('.')) }; });
}

export function createDB(state) {
  const db = state; // { tables: { name: [rows] }, users: [...], seq: n }
  db.tables ||= {}; db.seq ||= 1000;
  const T = (name) => (db.tables[name] ||= []);

  function project(table, row, select) {
    if (!select || select === '*') return { ...row };
    const out = {};
    for (const part of splitTop(select)) {
      const m = part.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?\((.*)\)$/);
      if (m) {
        const [, alias, target, fk, cols] = m;
        const col = fk ? fk.replace(new RegExp(`^${table}_`), '').replace(/_fkey$/, '') : `${target.replace(/s$/, '')}_id`;
        const hit = T(target).find((r) => r.id === row[col]);
        out[alias || target] = hit ? project(target, hit, cols) : null;
      } else if (part === '*') Object.assign(out, row);
      else out[part] = row[part];
    }
    return out;
  }

  function run({ table, filters = [], select = '*', order = [], limit, offset }) {
    let rows = T(table).filter((r) => filters.every((f) => matches(r, f)));
    if (order.length) {
      rows = [...rows].sort((a, b) => {
        for (const o of order) {
          const av = a[o.col]; const bv = b[o.col];
          if (av == null || bv == null) {
            if (av == null && bv == null) continue;
            const nullsFirst = o.nullsFirst ?? !o.ascending;
            return (av == null ? -1 : 1) * (nullsFirst ? 1 : -1);
          }
          const c = cmp(av, bv);
          if (c) return o.ascending ? c : -c;
        }
        return 0;
      });
    }
    const total = rows.length;
    if (offset) rows = rows.slice(offset);
    if (limit != null) rows = rows.slice(0, limit);
    return { rows: rows.map((r) => project(table, r, select)), total };
  }

  function defaults(table, row, uid) {
    const r = { ...row };
    if (!NO_UUID.has(table) && !SERIAL.has(table) && r.id == null) r.id = uuid();
    if (SERIAL.has(table) && r.id == null) r.id = ++db.seq;
    for (const k of ['created_at', 'updated_at']) if (r[k] === undefined && ['created_at'].includes(k)) r[k] = NOW();
    if (table === 'food_logs' || table === 'workout_logs' || table === 'progress_records' || table === 'progress_photos' || table === 'weekly_checkins' || table === 'saved_foods' || table === 'favorites') r.client_id ??= uid;
    if (table === 'weekly_checkins') { r.status ??= 'pending_review'; r.submitted_at ??= NOW(); }
    if (table === 'workout_logs') r.est_1rm = r.weight_kg > 0 && r.reps >= 1 && r.reps <= 12 ? Math.round(r.weight_kg * (1 + r.reps / 30) * 10) / 10 : null;
    if (table === 'coach_feedback' || table === 'coach_notes') r.author_id ??= uid;
    if (table === 'notifications') r.read_at ??= null;
    if (table === 'client_files') r.uploaded_at ??= NOW();
    if (table === 'saved_foods') r.use_count ??= 0;
    return r;
  }

  return {
    state: db,
    select: run,
    insert(table, rows, uid) {
      const list = (Array.isArray(rows) ? rows : [rows]).map((r) => defaults(table, r, uid));
      T(table).push(...list);
      // Mirrors the database trigger: coach feedback on a check-in marks it reviewed.
      if (table === 'coach_feedback') for (const r of list) { const c = T('weekly_checkins').find((x) => x.id === r.checkin_id); if (c) Object.assign(c, { status: 'reviewed', reviewed_at: NOW(), reviewed_by: uid }); }
      return list;
    },
    update(table, filters, patch) {
      const hit = T(table).filter((r) => filters.every((f) => matches(r, f)));
      hit.forEach((r) => { Object.assign(r, patch, { updated_at: NOW() }); if (table === 'workout_logs') r.est_1rm = r.weight_kg > 0 && r.reps >= 1 && r.reps <= 12 ? Math.round(r.weight_kg * (1 + r.reps / 30) * 10) / 10 : null; });
      return hit;
    },
    upsert(table, rows, onConflict, uid) {
      const keys = (onConflict || (table === 'site_settings' ? 'key' : 'id')).split(',');
      return (Array.isArray(rows) ? rows : [rows]).map((row) => {
        const hit = T(table).find((r) => keys.every((k) => String(r[k]) === String(row[k])));
        if (hit) { Object.assign(hit, row); return hit; }
        const r = defaults(table, row, uid); T(table).push(r); return r;
      });
    },
    remove(table, filters) {
      const keep = []; const gone = [];
      for (const r of T(table)) (filters.every((f) => matches(r, f)) ? gone : keep).push(r);
      db.tables[table] = keep;
      return gone;
    },
    table: T,
  };
}

// Parse a PostgREST query string (used by the Node-side REST handler for public pages).
export function parseRestQuery(table, search) {
  const p = new URLSearchParams(search);
  const q = { table, filters: [], select: p.get('select') || '*', order: [] };
  for (const [k, v] of p.entries()) {
    if (k === 'select') continue;
    if (k === 'order') { q.order = v.split(',').map((o) => { const [col, dir, nulls] = o.split('.'); return { col, ascending: dir !== 'desc', nullsFirst: nulls === 'nullsfirst' ? true : nulls === 'nullslast' ? false : undefined }; }); continue; }
    if (k === 'limit') { q.limit = Number(v); continue; }
    if (k === 'offset') { q.offset = Number(v); continue; }
    if (k === 'or') { q.filters.push({ op: 'or', val: parseOr(v.replace(/^\(|\)$/g, '')) }); continue; }
    const [op, ...rest] = v.split('.');
    let val = rest.join('.');
    if (op === 'in') val = val.replace(/^\(|\)$/g, '').split(',');
    else if (op === 'cs') val = val.replace(/^\{|\}$/g, '').split(',');
    else val = cast(val);
    q.filters.push({ col: k, op, val });
  }
  return q;
}
