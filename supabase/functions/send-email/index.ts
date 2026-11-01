// Sends queued emails from public.email_outbox through Resend or Brevo.
// The database calls this function whenever an email is queued, and a cron job retries every 10 minutes.
// Secrets (set in Supabase > Edge Functions > Secrets, never in the website code):
//   RESEND_API_KEY or BREVO_API_KEY   one of the two
//   EMAIL_FROM                        e.g. "GetFitWithPratik <coach@yourdomain.com>" (Resend) or "transformwithpratik@gmail.com" (Brevo verified sender)
//   EMAIL_REPLY_TO                    optional, defaults to transformwithpratik@gmail.com
//   SITE_URL                          optional, defaults to https://transformwithpratik.github.io
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { render } from './templates.ts';

const RESEND = Deno.env.get('RESEND_API_KEY');
const BREVO = Deno.env.get('BREVO_API_KEY');
const PROVIDER = RESEND ? 'resend' : BREVO ? 'brevo' : null;
const REPLY_TO = Deno.env.get('EMAIL_REPLY_TO') || 'transformwithpratik@gmail.com';
const SITE = (Deno.env.get('SITE_URL') || 'https://transformwithpratik.github.io').replace(/\/$/, '');
const FROM = Deno.env.get('EMAIL_FROM') || (RESEND ? 'GetFitWithPratik <onboarding@resend.dev>' : REPLY_TO);
const MAX_ATTEMPTS = 5;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function parseFrom(from: string) {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || 'GetFitWithPratik', email: m[2] } : { name: 'GetFitWithPratik', email: from.trim() };
}

async function deliver(to: string, subject: string, html: string, text: string): Promise<{ id?: string; error?: string; permanent?: boolean }> {
  try {
    if (RESEND) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [to], subject, html, text, reply_to: REPLY_TO }),
      });
      const b = await r.json().catch(() => ({}));
      if (r.ok) return { id: b.id };
      return { error: `Resend ${r.status}: ${b.message || b.name || 'error'}`, permanent: r.status >= 400 && r.status < 500 && r.status !== 429 };
    }
    const sender = parseFrom(FROM);
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': BREVO!, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html, textContent: text, replyTo: { email: REPLY_TO } }),
    });
    const b = await r.json().catch(() => ({}));
    if (r.ok) return { id: b.messageId };
    return { error: `Brevo ${r.status}: ${b.message || b.code || 'error'}`, permanent: r.status >= 400 && r.status < 500 && r.status !== 429 };
  } catch (e) {
    return { error: `Network error: ${(e as Error).message}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method === 'GET') return json({ provider: PROVIDER });
  if (!PROVIDER) return json({ processed: 0, error: 'No email provider configured (set RESEND_API_KEY or BREVO_API_KEY).' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const now = Date.now();
  // Emails that waited more than two days (for example before a provider was set up) are skipped, not sent late.
  await db.from('email_outbox').update({ status: 'skipped', last_error: 'Waited more than 48 hours in the queue' })
    .eq('status', 'queued').lt('created_at', new Date(now - 48 * 3600e3).toISOString());
  // Recover rows left in "sending" by an interrupted run.
  await db.from('email_outbox').update({ status: 'queued' }).eq('status', 'sending').lt('next_attempt_at', new Date(now - 10 * 60e3).toISOString());

  const { data: due } = await db.from('email_outbox').select('id').eq('status', 'queued').lte('next_attempt_at', new Date().toISOString()).order('created_at').limit(25);
  const ids = (due || []).map((r) => r.id);
  if (!ids.length) return json({ processed: 0 });
  // Claim the batch so concurrent runs never send the same email twice.
  const { data: claimed } = await db.from('email_outbox').update({ status: 'sending', next_attempt_at: new Date().toISOString() }).in('id', ids).eq('status', 'queued').select('*');

  let sent = 0; let failed = 0;
  for (const m of claimed || []) {
    const { html, text } = render(m.template, m.data || {}, SITE);
    const res = await deliver(m.to_email, m.subject, html, text);
    const attempts = (m.attempts || 0) + 1;
    if (res.id) {
      sent++;
      await db.from('email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), provider_id: String(res.id), attempts, last_error: null }).eq('id', m.id);
    } else {
      failed++;
      const giveUp = res.permanent || attempts >= MAX_ATTEMPTS;
      await db.from('email_outbox').update({
        status: giveUp ? 'failed' : 'queued', attempts, last_error: res.error?.slice(0, 500),
        next_attempt_at: new Date(Date.now() + 2 ** attempts * 60e3).toISOString(),
      }).eq('id', m.id);
    }
  }
  return json({ processed: (claimed || []).length, sent, failed, provider: PROVIDER });
});
