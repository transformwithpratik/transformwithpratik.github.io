// Lightweight read access for public pages, without loading supabase-js.
// Row level security decides what the anonymous key can see.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

export class ApiError extends Error {}

async function request(path, init = {}) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.');
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(body?.message || `Request failed (${res.status})`);
  return body;
}

// select('recipes', 'select=*&is_published=eq.true&order=sort_order')
export const select = (table, query = 'select=*') => request(`${table}?${query}`);
export const rpc = (fn, args = {}) => request(`rpc/${fn}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args),
});

// Public storage URL for a file in a public bucket, or the value itself if already a URL.
export function publicFileUrl(bucket, pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${pathOrUrl.split('/').map(encodeURIComponent).join('/')}`;
}
