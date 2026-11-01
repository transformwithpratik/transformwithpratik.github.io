// Permanently deletes the signed-in client's account and data.
// Removes their private files (progress photos, plan files), any linked enquiry, then the auth user;
// database rows cascade from the profile.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function removeFolder(db: ReturnType<typeof createClient>, bucket: string, folder: string) {
  for (let i = 0; i < 20; i++) {
    const { data } = await db.storage.from(bucket).list(folder, { limit: 100 });
    if (!data?.length) return;
    await db.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`));
    if (data.length < 100) return;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== 'DELETE') return json({ error: 'Confirmation missing' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return json({ error: 'Not signed in' }, 401);

  const { data: profile } = await db.from('profiles').select('role, lead_id, email').eq('id', user.id).maybeSingle();
  if (profile && profile.role !== 'client') return json({ error: 'Coach and admin accounts must be removed by another admin.' }, 403);

  await removeFolder(db, 'client-photos', user.id);
  await removeFolder(db, 'client-plans', user.id);
  const leadFilter = [profile?.lead_id ? `id.eq.${profile.lead_id}` : null, `converted_profile_id.eq.${user.id}`].filter(Boolean).join(',');
  await db.from('leads').delete().or(leadFilter);
  await db.from('client_invites').delete().eq('email', (profile?.email || user.email || '').toLowerCase());

  const { error: delErr } = await db.auth.admin.deleteUser(user.id);
  if (delErr) return json({ error: delErr.message }, 500);
  return json({ ok: true });
});
