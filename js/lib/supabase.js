// Authenticated Supabase client for the portal, admin and signed-in features.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});

// Throw readable errors instead of returning { error } objects.
export async function q(promise) {
  const { data, error, count } = await promise;
  if (error) {
    const msg = error.code === '42501' || /row-level security/i.test(error.message || '')
      ? 'You do not have permission to do that.'
      : error.message || 'Something went wrong.';
    const e = new Error(msg);
    e.code = error.code;
    throw e;
  }
  return count != null ? { data, count } : data;
}

export async function signedUrl(bucket, path, expires = 3600) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  const { data, error } = await supa.storage.from(bucket).createSignedUrl(path, expires);
  return error ? '' : data.signedUrl;
}

export async function signedUrls(bucket, paths, expires = 3600) {
  const list = [...new Set(paths.filter(Boolean))];
  if (!list.length) return {};
  const { data, error } = await supa.storage.from(bucket).createSignedUrls(list, expires);
  if (error) return {};
  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}

// Upload a file under the user's own folder; returns the storage path.
export async function uploadOwn(bucket, userId, file, prefix = '') {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const path = `${userId}/${prefix ? `${prefix}-` : ''}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supa.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return path;
}

// Resize large photos in the browser before upload (keeps uploads fast on mobile data).
export async function shrinkImage(file, maxSide = 1600, quality = 0.85) {
  if (!file.type.startsWith('image/') || /heic|heif/i.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5e6) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
