// Session and role checks shared by the portal and admin.
import { supa } from './supabase.js';

export async function getSession() {
  const { data } = await supa.auth.getSession();
  return data.session || null;
}

export async function getProfile(userId) {
  const { data, error } = await supa.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export const isStaff = (p) => p && (p.role === 'admin' || p.role === 'coach');

// Where a signed-in user should land.
export function homeFor(profile) {
  if (isStaff(profile)) return '/admin/';
  if (profile?.status === 'active') return '/portal/dashboard/';
  return '/portal/pending/';
}

// Guards a page. mode: 'client' (active clients), 'any' (any signed-in user), 'staff'.
export async function requireUser(mode = 'client') {
  const session = await getSession();
  const next = encodeURIComponent(location.pathname + location.search + location.hash);
  if (!session) { location.replace(`/portal/login/?next=${next}`); return null; }
  let profile;
  try { profile = await getProfile(session.user.id); } catch { profile = null; }
  if (!profile) {
    // Profile row is created by a database trigger on sign-up; give it a moment.
    await new Promise((r) => setTimeout(r, 1200));
    profile = await getProfile(session.user.id).catch(() => null);
  }
  if (!profile) { location.replace('/portal/pending/'); return null; }
  if (mode === 'staff' && !isStaff(profile)) { location.replace(homeFor(profile)); return null; }
  if (mode === 'client') {
    if (isStaff(profile)) { /* staff may preview the client portal */ }
    else if (profile.status !== 'active') { location.replace('/portal/pending/'); return null; }
  }
  return { session, user: session.user, profile };
}

export async function signOut() {
  await supa.auth.signOut();
  try { sessionStorage.clear(); } catch { /* ignore */ }
  location.replace('/portal/login/');
}

export function safeNext(next) {
  if (!next) return '';
  try {
    const u = new URL(next, location.origin);
    return u.origin === location.origin && (u.pathname.startsWith('/portal') || u.pathname.startsWith('/admin') || u.pathname.startsWith('/nutrition')) ? u.pathname + u.search + u.hash : '';
  } catch { return ''; }
}

export const siteOrigin = () => location.origin;
