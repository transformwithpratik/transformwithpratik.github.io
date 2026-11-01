import { $, $$, html, setHTML, formToObject, showErrors, clearErrors, busy, waLink, ymd } from '../lib/util.js';
import { initSite } from '../lib/site.js';
import { rpc } from '../lib/rest.js';

const form = $('#leadForm');
const DRAFT = 'gfp-lead-draft';
const STEP1 = ['name', 'email', 'whatsapp', 'age', 'height_cm', 'weight_kg', 'goal'];

const settings = await initSite();
const wa = settings.contact?.whatsapp;
if (waLink(wa)) $('[data-wa-side]').hidden = false;

// Plan options from settings
const planSel = form.elements.plan_interest;
(settings.plans || []).forEach((p) => planSel.insertAdjacentHTML('beforeend', String(html`<option>${p.name}</option>`)));
form.elements.start_date.min = ymd();

// Prefill: saved draft first, then URL params (from the calculator or a plan button)
try {
  const draft = JSON.parse(sessionStorage.getItem(DRAFT) || 'null');
  if (draft) fill(draft);
} catch { /* ignore */ }
const params = new URLSearchParams(location.search);
fill({ age: params.get('age'), height_cm: params.get('height_cm'), weight_kg: params.get('weight_kg'), goal: params.get('goal'), plan_interest: params.get('plan') });

function fill(data) {
  for (const [k, v] of Object.entries(data || {})) {
    if (v == null || v === '' || k === 'website' || k === 'consent') continue;
    const els = form.querySelectorAll(`[name="${k}"]`);
    els.forEach((el) => {
      if (el.type === 'radio') el.checked = el.value === v;
      else if (el.tagName === 'SELECT') { if ([...el.options].some((o) => o.value === v || o.text === v)) el.value = v; }
      else el.value = v;
    });
  }
}

form.addEventListener('input', () => {
  try { const d = formToObject(form); delete d.consent; sessionStorage.setItem(DRAFT, JSON.stringify(d)); } catch { /* ignore */ }
});

// ---------- Validation (mirrors the server rules in submit_lead) ----------
function validate(d, fields) {
  const e = {};
  const has = (f) => fields.includes(f);
  const digits = String(d.whatsapp || '').replace(/\D/g, '');
  if (has('name') && (!d.name || d.name.length < 2)) e.name = 'Enter your full name.';
  if (has('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || '')) e.email = 'Enter a valid email address.';
  if (has('whatsapp') && (digits.length < 10 || digits.length > 15)) e.whatsapp = 'Enter a WhatsApp number with 10 to 15 digits, including country code if outside India.';
  if (has('age') && !(Number(d.age) >= 16 && Number(d.age) <= 90)) e.age = 'Age must be between 16 and 90.';
  if (has('height_cm') && !(Number(d.height_cm) >= 120 && Number(d.height_cm) <= 230)) e.height_cm = 'Height must be between 120 and 230 cm.';
  if (has('weight_kg') && !(Number(d.weight_kg) >= 30 && Number(d.weight_kg) <= 300)) e.weight_kg = 'Weight must be between 30 and 300 kg.';
  if (has('goal') && !d.goal) e.goal = 'Choose a goal.';
  if (has('target_weight_kg') && d.target_weight_kg && !(Number(d.target_weight_kg) >= 30 && Number(d.target_weight_kg) <= 300)) e.target_weight_kg = 'Target weight must be between 30 and 300 kg.';
  if (has('consent') && !d.consent) e.consent = 'Please agree so I can contact you about coaching.';
  return e;
}

function goTo(step) {
  $$('[data-step]', form).forEach((el) => { el.hidden = el.dataset.step !== String(step); });
  $$('[data-step-bar]').forEach((el) => el.classList.toggle('on', Number(el.dataset.stepBar) <= step));
  $('[data-step-label]').textContent = step === 1 ? 'Step 1 of 2: About you' : 'Step 2 of 2: Your routine and preferences';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const first = $(`[data-step="${step}"] .input, [data-step="${step}"] input`, form);
  first?.focus({ preventScroll: true });
}

$('[data-next]').addEventListener('click', () => {
  const errors = validate(formToObject(form), STEP1);
  if (!showErrors(form, errors)) return;
  goTo(2);
});
$('[data-back]').addEventListener('click', () => { clearErrors(form); goTo(1); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = formToObject(form);
  const all = [...STEP1, 'target_weight_kg', 'consent'];
  const errors = validate(d, all);
  if (Object.keys(errors).some((k) => STEP1.includes(k))) { goTo(1); showErrors(form, errors); return; }
  if (!showErrors(form, errors)) return;

  const utm = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) if (params.get(k)) utm[k] = params.get(k);
  if (document.referrer && !document.referrer.startsWith(location.origin)) utm.referrer = document.referrer.slice(0, 200);

  await busy(form.querySelector('button[type="submit"]'), async () => {
    try {
      const res = await rpc('submit_lead', { p: { ...d, consent: true, utm } });
      if (!res?.ok) {
        const errs = res?.errors || { form: 'Something went wrong. Please try again.' };
        if (Object.keys(errs).some((k) => STEP1.includes(k))) goTo(1);
        showErrors(form, errs);
        return;
      }
      try { sessionStorage.removeItem(DRAFT); } catch { /* ignore */ }
      showSuccess(d);
    } catch (err) {
      showErrors(form, { form: `${err.message} Your details are still here, so you can try again.` });
    }
  });
});

function showSuccess(d) {
  const first = (d.name || '').split(' ')[0];
  $('[data-first-name]').textContent = first;
  const link = waLink(wa, `Hi Pratik, I'm ${d.name}. I just sent my details on your website about ${d.goal ? d.goal.replace(/_/g, ' ') : 'coaching'}.`);
  const btn = $('[data-wa-cta]');
  if (link) { btn.href = link; btn.hidden = false; }
  $('[data-form-view]').hidden = true;
  const view = $('[data-success-view]');
  view.hidden = false;
  view.focus();
  window.scrollTo({ top: 0 });
}
