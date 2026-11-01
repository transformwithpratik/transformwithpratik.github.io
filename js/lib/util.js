// Small DOM and formatting helpers shared by every page.
// All dynamic HTML goes through html`` which escapes interpolated values.

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s == null ? '' : String(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
function render(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  return esc(v);
}
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return new Raw(out);
}
export const setHTML = (el, content) => { if (el) el.innerHTML = Array.isArray(content) ? render(content) : String(content ?? ''); };

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Only allow http(s), mailto, tel and site-relative links in user-controlled URLs.
export function safeUrl(u) {
  if (!u) return '';
  const s = String(u).trim();
  if (/^(https?:|mailto:|tel:)/i.test(s) || s.startsWith('/')) return s;
  return '';
}

export function toast(message, type = 'ok', ms = 4200) {
  let box = $('[data-toasts]');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); box.dataset.toasts = ''; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = `toast ${type === 'error' ? 'error' : ''}`;
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const span = document.createElement('span');
  span.textContent = message;
  const close = document.createElement('button');
  close.type = 'button'; close.textContent = 'Dismiss'; close.addEventListener('click', () => t.remove());
  t.append(span, close);
  box.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export async function busy(btn, fn) {
  if (!btn) return fn();
  if (btn.getAttribute('aria-busy') === 'true') return undefined;
  btn.setAttribute('aria-busy', 'true');
  btn.disabled = true;
  try { return await fn(); } finally { btn.removeAttribute('aria-busy'); btn.disabled = false; }
}

export function formToObject(form) {
  const out = {};
  const fd = new FormData(form);
  for (const [k, v] of fd.entries()) {
    if (k in out) out[k] = [].concat(out[k], v);
    else out[k] = typeof v === 'string' ? v.trim() : v;
  }
  form.querySelectorAll('input[type="checkbox"][name]').forEach((cb) => {
    if (!form.querySelectorAll(`input[type="checkbox"][name="${cb.name}"]`)[1]) out[cb.name] = cb.checked;
  });
  return out;
}

export function clearErrors(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
}

// errors: { fieldName: 'message', form: 'general message' }
export function showErrors(form, errors = {}) {
  clearErrors(form);
  let first = null;
  for (const [name, msg] of Object.entries(errors)) {
    if (name === 'form') continue;
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    const slot = form.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
    if (input) { input.setAttribute('aria-invalid', 'true'); if (slot?.id) input.setAttribute('aria-describedby', slot.id); }
    if (slot) slot.textContent = msg;
    if (!first) first = input || slot;
  }
  const general = form.querySelector('[data-error-for="form"]');
  if (general) general.textContent = errors.form || (Object.keys(errors).length ? 'Please fix the highlighted fields.' : '');
  if (first?.focus) first.focus({ preventScroll: false });
  return Object.keys(errors).length === 0;
}

export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// Dates: the user's local calendar day, as YYYY-MM-DD.
export const ymd = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const parseYmd = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const mondayOf = (s = ymd()) => { const d = parseYmd(s); const off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return ymd(d); };
export function fmtDate(s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!s) return '';
  const d = s.length === 10 ? parseYmd(s) : new Date(s);
  return d.toLocaleDateString('en-IN', opts);
}
export const fmtDateTime = (s) => (s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
export function timeAgo(s) {
  const sec = Math.round((Date.now() - new Date(s).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const m = Math.round(sec / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  return fmtDate(s);
}
export const fmtNum = (n, digits = 0) => (n == null || Number.isNaN(Number(n)) ? '' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 }));
export const fmtMoney = (n, cur = 'INR') => (n == null ? '' : Number(n).toLocaleString('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }));
export const numOrNull = (v) => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
export const intOrNull = (v) => { const n = numOrNull(v); return n == null ? null : Math.round(n); };

export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export const LABELS = {
  goal: { fat_loss: 'Fat loss', muscle_gain: 'Muscle gain', recomposition: 'Body recomposition', strength: 'Strength', general_fitness: 'General fitness' },
  status: { pending: 'Pending approval', active: 'Active', inactive: 'Inactive', completed: 'Completed', rejected: 'Not accepted' },
  lead: { new: 'New', contacted: 'Contacted', consult_booked: 'Consult booked', converted: 'Converted', not_a_fit: 'Not a fit', lost: 'Lost' },
  meal: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', pre_workout: 'Pre-workout', post_workout: 'Post-workout' },
  diet: { vegetarian: 'Vegetarian', eggetarian: 'Eggetarian', non_vegetarian: 'Non-vegetarian', vegan: 'Vegan', jain: 'Jain', gluten_free: 'Gluten-free' },
  experience: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
  location: { gym: 'Gym', home: 'Home', both: 'Gym and home', outdoors: 'Outdoors' },
  relationship: { current_client: 'Current client', past_client: 'Past client', follower: 'Follower', friend_family: 'Friend or family' },
  category: { high_protein_veg: 'High-protein veg', snacks: 'Snacks', breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', office: 'Office-friendly', pre_workout: 'Pre-workout', post_workout: 'Post-workout', fat_loss: 'Fat loss', muscle_gain: 'Muscle gain' },
  tf: { fat_loss: 'Fat loss', muscle_gain: 'Muscle gain', recomposition: 'Recomposition' },
  muscle: { legs: 'Legs', glutes: 'Glutes', chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', core: 'Core', full_body: 'Full body', cardio: 'Cardio', mobility: 'Mobility' },
  equipment: { bodyweight: 'Bodyweight', dumbbell: 'Dumbbell', barbell: 'Barbell', machine: 'Machine', cable: 'Cable', kettlebell: 'Kettlebell', band: 'Band', other: 'Other' },
  resourceCat: { nutrition: 'Nutrition', training: 'Training', supplements: 'Supplements', sleep_recovery: 'Sleep and recovery', busy_professionals: 'Busy professionals', office: 'Office', travel: 'Travel', recipes: 'Recipes', other: 'Other' },
};
export const label = (group, key) => (LABELS[group] && LABELS[group][key]) || (key ? String(key).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '');

export function waLink(number, text = '') {
  const digits = String(number || '').replace(/\D/g, '');
  if (digits.length < 10) return '';
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

// Turn a YouTube URL into a privacy-friendly embed URL, or '' if it is not YouTube.
export function youtubeEmbed(url) {
  if (!url) return '';
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : '';
}

export function downloadFile(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function toCSV(rows) {
  if (!rows?.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}

export function confirmDialog({ title = 'Are you sure?', body = '', confirm = 'Delete', danger = true } = {}) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.innerHTML = String(html`<form method="dialog">
      <div class="modal-head"><h2>${title}</h2></div>
      <div class="modal-body"><p>${body}</p></div>
      <div class="modal-foot">
        <button class="btn btn-ghost btn-sm" value="cancel">Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm" value="ok">${confirm}</button>
      </div></form>`);
    document.body.appendChild(d);
    d.addEventListener('close', () => { resolve(d.returnValue === 'ok'); d.remove(); });
    d.showModal();
    d.querySelector('[value="cancel"]').focus();
  });
}

// Wire up an accessible tab list. Panels are found by aria-controls.
export function initTabs(tablist, onChange) {
  const tabs = $$('[role="tab"]', tablist);
  const select = (tab, focus = false) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
    onChange?.(tab.dataset.tab || tab.id);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        select(n, true);
      }
    });
  });
  return { select: (key) => { const t = tabs.find((x) => (x.dataset.tab || x.id) === key); if (t) select(t); } };
}
