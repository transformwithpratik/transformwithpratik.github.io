// Test-only stand-in for @supabase/supabase-js. The e2e runner serves this file in place of the
// CDN module. Queries are sent to the runner's in-memory database (fake-db.mjs) so the portal,
// admin and public pages all see the same data. Row level security is not simulated here; the
// access rules are tested in SQL against the real project.
const AUTH_KEY = 'sb-trerqtscrsrlcfsnfetn-auth-token';
const session = () => { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; } };
const uid = () => session()?.user?.id || null;

async function call(kind, body) {
  const res = await fetch(`/__fake/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, uid: uid() }) });
  return res.json();
}

class Query {
  constructor(table) { Object.assign(this, { table, filters: [], orders: [], op: 'select', cols: '*', want: false, mode: 'many', countOpt: null }); }
  select(cols = '*', opts = {}) { if (this.op === 'select') { this.cols = cols; this.countOpt = opts; } else { this.want = true; this.retCols = cols; } return this; }
  insert(rows) { this.op = 'insert'; this.payload = rows; return this; }
  update(patch) { this.op = 'update'; this.payload = patch; return this; }
  upsert(rows, opts = {}) { this.op = 'upsert'; this.payload = rows; this.onConflict = opts.onConflict; return this; }
  delete() { this.op = 'delete'; return this; }
  _f(col, op, val) { this.filters.push({ col, op, val }); return this; }
  eq(c, v) { return this._f(c, 'eq', v); } neq(c, v) { return this._f(c, 'neq', v); }
  gt(c, v) { return this._f(c, 'gt', v); } gte(c, v) { return this._f(c, 'gte', v); }
  lt(c, v) { return this._f(c, 'lt', v); } lte(c, v) { return this._f(c, 'lte', v); }
  in(c, v) { return this._f(c, 'in', v); } is(c, v) { return this._f(c, 'is', v); }
  ilike(c, v) { return this._f(c, 'ilike', v); } like(c, v) { return this._f(c, 'like', v); }
  contains(c, v) { return this._f(c, 'cs', v); }
  not(c, op, v) { this.filters.push({ col: c, op: 'not', inner: op, val: v === 'null' ? null : v }); return this; }
  or(s) { this.filters.push({ op: 'or_raw', val: s }); return this; }
  order(col, o = {}) { this.orders.push({ col, ascending: o.ascending !== false, nullsFirst: o.nullsFirst }); return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.offset = a; this.lim = b - a + 1; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  then(res, rej) {
    const { table, filters, orders, op, cols, want, mode, countOpt, payload, onConflict, lim, offset } = this;
    return call('db', { table, filters, order: orders, op, cols, want, mode, countOpt, payload, onConflict, limit: lim, offset }).then(res, rej);
  }
}

const P = (data, error = null) => Promise.resolve({ data, error });

export function createClient() {
  const listeners = [];
  const emit = (ev, s) => listeners.forEach((cb) => { try { cb(ev, s); } catch { /* ignore */ } });
  const setSession = (user) => {
    const s = { access_token: `fake.${btoa(JSON.stringify({ sub: user.id }))}.sig`, refresh_token: 'r', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user };
    localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    emit('SIGNED_IN', s);
    return s;
  };
  // Mirrors detectSessionInUrl for the implicit flow (recovery links land with #access_token=...).
  if (/access_token=/.test(location.hash)) {
    const h = new URLSearchParams(location.hash.slice(1));
    const user = { id: h.get('access_token').split('.')[1], email: 'reset@example.com' };
    const s = setSession(user);
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => emit(h.get('type') === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN', s), 0);
  }
  return {
    from: (t) => new Query(t),
    rpc: (name, args) => call('rpc', { name, args: args || {} }),
    auth: {
      getSession: () => P({ session: session() }),
      getUser: () => P({ user: session()?.user || null }),
      onAuthStateChange: (cb) => { listeners.push(cb); setTimeout(() => cb('INITIAL_SESSION', session()), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      async signInWithPassword({ email, password }) {
        const r = await call('auth', { action: 'signin', email, password });
        if (r.error) return { data: { session: null, user: null }, error: r.error };
        const s = setSession(r.user);
        return { data: { session: s, user: s.user }, error: null };
      },
      async signUp({ email, password, options }) {
        const r = await call('auth', { action: 'signup', email, password, full_name: options?.data?.full_name });
        return { data: { user: r.user, session: null }, error: r.error || null };
      },
      signOut: () => { localStorage.removeItem(AUTH_KEY); emit('SIGNED_OUT', null); return P(null); },
      resetPasswordForEmail: (email) => call('auth', { action: 'reset', email }).then(() => ({ data: {}, error: null })),
      async updateUser(attrs) {
        if (!session()) return { data: { user: null }, error: { message: 'Auth session missing!' } };
        await call('auth', { action: 'update', attrs });
        return { data: { user: session().user }, error: null };
      },
      resend: () => P({}),
      signInWithOAuth: () => P(null, { message: 'Unsupported provider: provider is not enabled' }),
    },
    storage: {
      from: (bucket) => ({
        upload: (path) => call('storage', { action: 'upload', bucket, path }).then(() => ({ data: { path }, error: null })),
        createSignedUrl: (path) => P({ signedUrl: `/tests/e2e/pixel.png?${bucket}/${path}` }),
        createSignedUrls: (paths) => P(paths.map((path) => ({ path, signedUrl: `/tests/e2e/pixel.png?${bucket}/${path}` }))),
        remove: (paths) => call('storage', { action: 'remove', bucket, paths }).then(() => ({ data: [], error: null })),
        list: () => P([]),
        getPublicUrl: (path) => ({ data: { publicUrl: `/tests/e2e/pixel.png?${bucket}/${path}` } }),
      }),
    },
  };
}
