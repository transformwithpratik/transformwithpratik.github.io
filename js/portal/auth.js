// Login, registration, password recovery, post-login routing and the pending-approval screen.
import { supa } from '../lib/supabase.js';
import { getProfile, homeFor, safeNext, signOut, isStaff } from '../lib/auth.js';
import { $, html, raw, setHTML, showErrors, formToObject, busy, toast, waLink, LABELS } from '../lib/util.js';
import { getSettings } from '../lib/settings.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUSINESS_EMAIL } from '../config.js';

const box = $('[data-auth]');
const page = document.body.dataset.page;
const params = new URLSearchParams(location.search);
const next = safeNext(params.get('next'));
const brand = box.querySelector('.brand').outerHTML;
const origin = location.origin;

const googleSvg = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.1 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"/></svg>');

async function authSettings() {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
    return r.ok ? await r.json() : {};
  } catch { return {}; }
}

function friendly(err) {
  const m = (err?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'Email or password is incorrect.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox for the link.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists. Log in, or reset your password.';
  if (m.includes('sending') && m.includes('email')) return `We could not send the email just now. Please try again later, or write to ${BUSINESS_EMAIL}.`;
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (m.includes('password') && (m.includes('weak') || m.includes('short') || m.includes('characters'))) return 'Choose a stronger password: at least 8 characters, ideally a short phrase.';
  if (m.includes('unsupported provider') || m.includes('provider is not enabled')) return 'Google sign-in is not switched on yet. Use your email and password.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Could not reach the server. Check your connection and try again.';
  return err?.message || 'Something went wrong. Please try again.';
}

async function goHome(session) {
  const profile = await getProfile(session.user.id).catch(() => null);
  if (!profile) { location.replace('/portal/pending/'); return; }
  const dest = next && (isStaff(profile) || profile.status === 'active' || next.startsWith('/nutrition')) ? next : homeFor(profile);
  location.replace(dest);
}

function googleButton(enabled) {
  if (!enabled) return '';
  return html`<button class="btn btn-google btn-block" type="button" data-google>${googleSvg} Continue with Google</button><div class="divider">or with email</div>`;
}

async function onGoogle() {
  const redirectTo = `${origin}/portal/${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  const { error } = await supa.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) toast(friendly(error), 'error');
}

// ---------------------------------------------------------------------------
async function routerPage() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const hashError = hash.get('error_description') || params.get('error_description');
  const type = hash.get('type');
  const { data } = await supa.auth.getSession();
  if (type === 'recovery' && data.session) { location.replace('/portal/reset/'); return; }
  if (data.session) { await goHome(data.session); return; }
  if (hashError) {
    const expired = /expired|invalid/i.test(hashError);
    setHTML(box, html`${raw(brand)}<h1>That link did not work</h1>
      <p class="muted">${expired ? 'The link has expired or was already used. Links work once and expire after a while.' : hashError}</p>
      <div class="cluster" style="margin-top:20px"><a class="btn btn-primary" href="/portal/login/">Go to log in</a><a class="btn btn-ghost" href="/portal/forgot/">Send a new reset link</a></div>`);
    return;
  }
  location.replace(`/portal/login/${next ? `?next=${encodeURIComponent(next)}` : ''}`);
}

// ---------------------------------------------------------------------------
async function loginPage() {
  const { data } = await supa.auth.getSession();
  if (data.session) { await goHome(data.session); return; }
  const settings = await authSettings();
  setHTML(box, html`${raw(brand)}
    <h1>Log in</h1>
    <p class="muted">Clients and coaches use the same login.</p>
    ${params.get('reset') === '1' ? html`<div class="notice ok" style="margin:12px 0">Your password was updated. Log in with the new one.</div>` : ''}
    <form class="form" id="loginForm" novalidate style="margin-top:20px">
      ${googleButton(settings.external?.google)}
      <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required><p class="field-error" data-error-for="email" id="err-email"></p></div>
      <div class="field"><div class="cluster" style="justify-content:space-between"><label for="password">Password</label><a class="small" href="/portal/forgot/">Forgot password?</a></div>
        <input class="input" id="password" name="password" type="password" autocomplete="current-password" required><p class="field-error" data-error-for="password" id="err-password"></p></div>
      <p class="field-error" data-error-for="form" role="alert" id="err-form"></p>
      <div data-resend hidden><button class="btn btn-ghost btn-sm" type="button" data-resend-btn>Resend confirmation email</button></div>
      <button class="btn btn-primary btn-block" type="submit">Log in</button>
      <p class="small muted" style="text-align:center">New here? <a href="/portal/register/${next ? `?next=${encodeURIComponent(next)}` : ''}">Create an account</a></p>
    </form>`);
  $('[data-google]')?.addEventListener('click', onGoogle);
  const form = $('#loginForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formToObject(form);
    const errs = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) errs.email = 'Enter your email address.';
    if (!d.password) errs.password = 'Enter your password.';
    if (!showErrors(form, errs)) return;
    busy(form.querySelector('[type="submit"]'), async () => {
      const { data: res, error } = await supa.auth.signInWithPassword({ email: d.email, password: d.password });
      if (error) {
        showErrors(form, { form: friendly(error) });
        if (/not confirmed/i.test(error.message)) $('[data-resend]').hidden = false;
        return;
      }
      await goHome(res.session);
    });
  });
  $('[data-resend-btn]').addEventListener('click', async (e) => {
    const email = form.elements.email.value.trim();
    await busy(e.currentTarget, async () => {
      const { error } = await supa.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${origin}/portal/` } });
      if (error) toast(friendly(error), 'error'); else toast('Confirmation email sent. Check your inbox and spam folder.');
    });
  });
}

// ---------------------------------------------------------------------------
async function registerPage() {
  const { data } = await supa.auth.getSession();
  if (data.session) { await goHome(data.session); return; }
  const settings = await authSettings();
  if (settings.disable_signup) {
    setHTML(box, html`${raw(brand)}<h1>Sign-ups are paused</h1><p class="muted">New accounts are created after a consult call. <a href="/book">Send your details</a> and I will get back to you.</p>`);
    return;
  }
  setHTML(box, html`${raw(brand)}
    <h1>Create your account</h1>
    <p class="muted">For coaching clients. After you sign up, Pratik approves your account and sets up your plan. Not a client yet? <a href="/book">Start here</a>.</p>
    <form class="form" id="regForm" novalidate style="margin-top:20px">
      ${googleButton(settings.external?.google)}
      <div class="field"><label for="full_name">Full name</label><input class="input" id="full_name" name="full_name" autocomplete="name" required maxlength="100"><p class="field-error" data-error-for="full_name" id="e1"></p></div>
      <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required><p class="hint">Use the same email you gave in your enquiry so your details link up.</p><p class="field-error" data-error-for="email" id="e2"></p></div>
      <div class="field"><label for="phone">WhatsApp number <span class="muted">(optional)</span></label><input class="input" id="phone" name="phone" type="tel" autocomplete="tel" maxlength="20"></div>
      <div class="form-row">
        <div class="field"><label for="password">Password</label><input class="input" id="password" name="password" type="password" autocomplete="new-password" required minlength="8"><p class="hint">At least 8 characters.</p><p class="field-error" data-error-for="password" id="e3"></p></div>
        <div class="field"><label for="password2">Confirm password</label><input class="input" id="password2" name="password2" type="password" autocomplete="new-password" required><p class="field-error" data-error-for="password2" id="e4"></p></div>
      </div>
      <label class="check"><input type="checkbox" name="consent"> <span>I agree to the <a href="/privacy" target="_blank">privacy notice</a>, including storing my progress data and photos privately for coaching.</span></label>
      <p class="field-error" data-error-for="consent" id="e5"></p>
      <p class="field-error" data-error-for="form" role="alert" id="e6"></p>
      <button class="btn btn-primary btn-block" type="submit">Create account</button>
      <p class="small muted" style="text-align:center">Already have an account? <a href="/portal/login/">Log in</a></p>
    </form>`);
  $('[data-google]')?.addEventListener('click', onGoogle);
  const form = $('#regForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formToObject(form);
    const errs = {};
    if (!d.full_name || d.full_name.length < 2) errs.full_name = 'Enter your full name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) errs.email = 'Enter a valid email address.';
    if ((d.password || '').length < 8) errs.password = 'Use at least 8 characters.';
    if (d.password !== d.password2) errs.password2 = 'Passwords do not match.';
    if (!d.consent) errs.consent = 'Please agree to continue.';
    if (!showErrors(form, errs)) return;
    busy(form.querySelector('[type="submit"]'), async () => {
      const { data: res, error } = await supa.auth.signUp({
        email: d.email, password: d.password,
        options: { data: { full_name: d.full_name, phone: d.phone || null }, emailRedirectTo: `${origin}/portal/` },
      });
      if (error) { showErrors(form, { form: friendly(error) }); return; }
      if (res.session) { await goHome(res.session); return; }
      const exists = res.user && Array.isArray(res.user.identities) && res.user.identities.length === 0;
      setHTML(box, html`${raw(brand)}
        <span class="tag tag-lime">One more step</span>
        <h1 style="margin-top:14px">Check your email</h1>
        <p class="muted">${exists ? 'If an account already exists for this email, log in or reset your password. Otherwise, we have sent you a confirmation link.' : html`We sent a confirmation link to <b>${d.email}</b>. Open it to finish creating your account. It can take a couple of minutes, and sometimes lands in spam.`}</p>
        <div class="cluster" style="margin-top:20px"><a class="btn btn-primary" href="/portal/login/">Go to log in</a><button class="btn btn-ghost" type="button" data-resend>Resend email</button></div>`);
      $('[data-resend]').addEventListener('click', async (ev) => {
        await busy(ev.currentTarget, async () => {
          const { error: err } = await supa.auth.resend({ type: 'signup', email: d.email, options: { emailRedirectTo: `${origin}/portal/` } });
          if (err) toast(friendly(err), 'error'); else toast('Sent again. Check your inbox and spam folder.');
        });
      });
    });
  });
}

// ---------------------------------------------------------------------------
function forgotPage() {
  setHTML(box, html`${raw(brand)}
    <h1>Reset your password</h1>
    <p class="muted">Enter your account email and we will send a link to choose a new password.</p>
    <form class="form" id="forgotForm" novalidate style="margin-top:20px">
      <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required><p class="field-error" data-error-for="email" id="fe1"></p></div>
      <p class="field-error" data-error-for="form" role="alert" id="fe2"></p>
      <button class="btn btn-primary btn-block" type="submit">Send reset link</button>
      <p class="small muted" style="text-align:center"><a href="/portal/login/">Back to log in</a></p>
    </form>`);
  const form = $('#forgotForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    if (!showErrors(form, /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? {} : { email: 'Enter a valid email address.' })) return;
    busy(form.querySelector('[type="submit"]'), async () => {
      const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/portal/reset/` });
      if (error && !/not found/i.test(error.message)) { showErrors(form, { form: friendly(error) }); return; }
      setHTML(box, html`${raw(brand)}<h1>Check your email</h1>
        <p class="muted">If an account exists for <b>${email}</b>, a reset link is on its way. The link works once. Check spam if it does not arrive in a few minutes.</p>
        <p style="margin-top:20px"><a class="btn btn-ghost" href="/portal/login/">Back to log in</a></p>`);
    });
  });
}

// ---------------------------------------------------------------------------
async function resetPage() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const errDesc = hash.get('error_description');
  const { data } = await supa.auth.getSession();
  if (!data.session) {
    setHTML(box, html`${raw(brand)}<h1>Link expired</h1>
      <p class="muted">${errDesc ? 'This reset link has expired or was already used.' : 'Open the link from your reset email to choose a new password.'}</p>
      <p style="margin-top:20px"><a class="btn btn-primary" href="/portal/forgot/">Send a new link</a></p>`);
    return;
  }
  setHTML(box, html`${raw(brand)}
    <h1>Choose a new password</h1>
    <p class="muted">For ${data.session.user.email}</p>
    <form class="form" id="resetForm" novalidate style="margin-top:20px">
      <div class="field"><label for="password">New password</label><input class="input" id="password" name="password" type="password" autocomplete="new-password" required minlength="8"><p class="hint">At least 8 characters.</p><p class="field-error" data-error-for="password" id="re1"></p></div>
      <div class="field"><label for="password2">Confirm new password</label><input class="input" id="password2" name="password2" type="password" autocomplete="new-password" required><p class="field-error" data-error-for="password2" id="re2"></p></div>
      <p class="field-error" data-error-for="form" role="alert" id="re3"></p>
      <button class="btn btn-primary btn-block" type="submit">Save new password</button>
    </form>`);
  const form = $('#resetForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formToObject(form);
    const errs = {};
    if ((d.password || '').length < 8) errs.password = 'Use at least 8 characters.';
    if (d.password !== d.password2) errs.password2 = 'Passwords do not match.';
    if (!showErrors(form, errs)) return;
    busy(form.querySelector('[type="submit"]'), async () => {
      const { error } = await supa.auth.updateUser({ password: d.password });
      if (error) { showErrors(form, { form: friendly(error) }); return; }
      toast('Password updated');
      await goHome(data.session);
    });
  });
}

// ---------------------------------------------------------------------------
async function pendingPage() {
  const { data } = await supa.auth.getSession();
  if (!data.session) { location.replace('/portal/login/'); return; }
  const profile = await getProfile(data.session.user.id).catch(() => null);
  if (profile && (isStaff(profile) || profile.status === 'active')) { location.replace(homeFor(profile)); return; }
  const s = await getSettings();
  const wa = waLink(s.contact?.whatsapp, `Hi Pratik, I just created my portal account (${data.session.user.email}).`);
  const status = profile?.status || 'pending';
  const copy = {
    pending: { tag: 'Waiting for approval', h: 'Your account is created', p: 'Pratik approves every client account personally, usually within a day of your consult call. You will get an email when your portal is ready. Meanwhile, the free tools are open to you.' },
    rejected: { tag: 'Not active', h: 'Your account is not active', p: 'Coaching was not set up for this account. If you think this is a mistake, get in touch.' },
    inactive: { tag: 'Paused', h: 'Your coaching is paused', p: 'Your account is inactive right now. Get in touch to restart your coaching; your past logs are kept safe.' },
    completed: { tag: 'Completed', h: 'Your coaching programme has ended', p: 'Thank you for working together. Your history is kept safe. Get in touch to start a new block.' },
  }[status] || {};
  setHTML(box, html`${raw(brand)}
    <span class="tag ${status === 'pending' ? 'tag-warn' : ''}">${copy.tag}</span>
    <h1 style="margin-top:14px">${copy.h}</h1>
    <p class="muted">${copy.p}</p>
    <div class="card card-flat" style="margin-top:20px">
      <p class="small muted" style="margin:0 0 6px">Signed in as</p>
      <p style="margin:0"><b>${profile?.full_name || ''}</b> ${data.session.user.email}</p>
      ${profile?.goal ? html`<p class="small muted" style="margin:6px 0 0">Goal: ${LABELS.goal[profile.goal] || profile.goal}</p>` : ''}
    </div>
    <div class="cluster" style="margin-top:20px">
      ${status === 'pending' ? html`<button class="btn btn-primary" type="button" data-refresh>Check again</button>` : ''}
      ${wa ? html`<a class="btn btn-ghost" href="${wa}" target="_blank" rel="noopener">Message on WhatsApp</a>` : html`<a class="btn btn-ghost" href="mailto:${s.contact?.email || BUSINESS_EMAIL}">Email Pratik</a>`}
      ${status === 'pending' && !profile?.lead_id ? html`<a class="btn btn-quiet" href="/book">Send your coaching details</a>` : ''}
    </div>
    <p class="small muted" style="margin-top:28px">While you wait: <a href="/calculator">calculators</a> · <a href="/nutrition">recipes</a> · <a href="/library">guides</a></p>
    <p style="margin-top:12px"><button class="link-btn small" type="button" data-signout>Sign out</button></p>`);
  $('[data-signout]').addEventListener('click', signOut);
  $('[data-refresh]')?.addEventListener('click', async (e) => {
    await busy(e.currentTarget, async () => {
      const p = await getProfile(data.session.user.id).catch(() => null);
      if (p?.status === 'active') location.replace('/portal/dashboard/');
      else toast('Not approved yet. You will get an email when it is.');
    });
  });
}

const pages = { router: routerPage, login: loginPage, register: registerPage, forgot: forgotPage, reset: resetPage, pending: pendingPage };
try {
  await pages[page]?.();
} catch (err) {
  setHTML(box, html`${raw(brand)}<h1>Something went wrong</h1><p class="muted">${friendly(err)}</p><p><a class="btn btn-ghost" href="/portal/login/">Try again</a></p>`);
}
