import { mountPortal, loadPlans, openModal } from '../lib/portal.js';
import { supa, q, uploadOwn, shrinkImage, signedUrls } from '../lib/supabase.js';
import { $, $$, html, raw, setHTML, fmtNum, fmtDate, ymd, addDays, label, LABELS, numOrNull, intOrNull, toast, confirmDialog, initTabs, debounce, esc } from '../lib/util.js';
import { sumMacros } from '../lib/calc.js';
import { icon } from '../lib/icons.js';
import { targetsOf, loadDays } from './data.js';
import { openQuickLog } from './quicklog.js';


const MEALS = Object.keys(LABELS.meal);
const UNITS = ['g', 'ml', 'piece', 'katori', 'cup', 'tbsp', 'tsp', 'slice', 'scoop', 'serving'];
const state = { date: ymd(), uid: null, plans: null, t: null, foods: [], saved: [], exercises: [], prs: {} };

async function init({ user, content }) {
  state.uid = user.id;
  const qd = new URLSearchParams(location.search).get('date');
  if (qd && /^\d{4}-\d{2}-\d{2}$/.test(qd)) state.date = qd;
  const [plans, foods, saved, exercises] = await Promise.all([
    loadPlans(user.id),
    q(supa.from('foods').select('*').order('name')),
    q(supa.from('saved_foods').select('*').eq('client_id', user.id).order('use_count', { ascending: false })),
    q(supa.from('exercises').select('name,slug,muscle_group').order('name')),
  ]);
  Object.assign(state, { plans, t: targetsOf(plans.targets), foods, saved, exercises });

  setHTML(content, html`
    <div class="page-intro">
      <div><h2>Food and workouts</h2><p>Everything you log is private to you and your coach.</p></div>
      <div class="date-nav" aria-label="Date">
        <button class="icon-btn" type="button" data-day="-1"><span class="sr-only">Previous day</span>${raw(icon('left'))}</button>
        <input class="input" type="date" data-date max="${ymd()}" aria-label="Log date">
        <button class="icon-btn" type="button" data-day="1"><span class="sr-only">Next day</span>${raw(icon('right'))}</button>
        <button class="btn btn-quiet btn-sm" type="button" data-today>Today</button>
      </div>
    </div>
    <div class="tabs" role="tablist" aria-label="Log type" data-tabs>
      <button role="tab" data-tab="food" id="t-food" aria-controls="p-food" aria-selected="true">Food</button>
      <button role="tab" data-tab="workouts" id="t-workouts" aria-controls="p-workouts" aria-selected="false" tabindex="-1">Workouts</button>
      <button role="tab" data-tab="checklist" id="t-checklist" aria-controls="p-checklist" aria-selected="false" tabindex="-1">Daily checklist</button>
    </div>
    <section id="p-food" role="tabpanel" aria-labelledby="t-food" data-food></section>
    <section id="p-workouts" role="tabpanel" aria-labelledby="t-workouts" hidden data-workouts></section>
    <section id="p-checklist" role="tabpanel" aria-labelledby="t-checklist" hidden data-checklist></section>
    <datalist id="food-options">${[...state.saved.map((s) => s.name), ...state.foods.map((f) => f.name)].filter((v, i, a) => a.indexOf(v) === i).map((n) => html`<option value="${n}"></option>`)}</datalist>
  `);

  const dateInput = $('[data-date]');
  dateInput.value = state.date;
  const setDate = (d) => { if (d > ymd()) return; state.date = d; dateInput.value = d; refresh(); };
  dateInput.addEventListener('change', () => dateInput.value && setDate(dateInput.value));
  $$('[data-day]').forEach((b) => b.addEventListener('click', () => setDate(addDays(state.date, Number(b.dataset.day)))));
  $('[data-today]').addEventListener('click', () => setDate(ymd()));

  let current = 'food';
  const tabs = initTabs($('[data-tabs]'), (key) => { current = key; history.replaceState(null, '', `#${key}`); refresh(); });
  const fromHash = location.hash.slice(1);
  if (['food', 'workouts', 'checklist'].includes(fromHash)) tabs.select(fromHash); else refresh();
  function refresh() {
    if (current === 'food') renderFood();
    else if (current === 'workouts') renderWorkouts();
    else renderChecklist();
  }
  state.refresh = refresh;
}

// ======================================================================= FOOD
async function renderFood() {
  const el = $('[data-food]');
  setHTML(el, html`<div class="skeleton" style="height:90px"></div><div class="skeleton" style="height:240px;margin-top:16px"></div>`);
  const [rows, week] = await Promise.all([
    q(supa.from('food_logs').select('*').eq('client_id', state.uid).eq('log_date', state.date).order('created_at')),
    loadDays(state.uid, addDays(state.date, -6), state.date),
  ]);
  const photos = await signedUrls('client-photos', rows.map((r) => r.photo_path));
  const tot = sumMacros(rows);
  const t = state.t;
  const bar = (v, target) => (target ? html`<div class="progress ${v > target * 1.1 ? 'warn' : ''}"><span style="width:${Math.min(100, (v / target) * 100)}%"></span></div>` : '');
  const byMeal = MEALS.map((m) => ({ meal: m, items: rows.filter((r) => r.meal === m) })).filter((g) => g.items.length);
  const weekLogged = week.filter((d) => d.calories);
  const avg = (k) => (weekLogged.length ? weekLogged.reduce((s, d) => s + (d[k] || 0), 0) / weekLogged.length : 0);

  setHTML(el, html`
    <div class="totals">
      <div class="total"><b>${fmtNum(tot.calories)}</b><span>kcal${t.calories ? ` of ${fmtNum(t.calories)}` : ''}</span>${bar(tot.calories, t.calories)}</div>
      <div class="total"><b>${fmtNum(tot.protein_g)} g</b><span>protein${t.protein ? ` of ${t.protein}` : ''}</span>${bar(tot.protein_g, t.protein)}</div>
      <div class="total"><b>${fmtNum(tot.carbs_g)} g</b><span>carbs${t.carbs ? ` of ${t.carbs}` : ''}</span>${bar(tot.carbs_g, t.carbs)}</div>
      <div class="total"><b>${fmtNum(tot.fat_g)} g</b><span>fat${t.fat ? ` of ${t.fat}` : ''}</span>${bar(tot.fat_g, t.fat)}</div>
    </div>
    <div class="cluster" style="margin-bottom:18px">
      <button class="btn btn-primary btn-sm" type="button" data-add-food>${raw(icon('plus'))} Add food</button>
      <button class="btn btn-ghost btn-sm" type="button" data-copy-day>Copy yesterday</button>
    </div>
    <div class="panel-grid">
      <section class="panel" aria-label="Meals">
        ${byMeal.length ? byMeal.map((g) => {
    const s = sumMacros(g.items);
    return html`<div class="meal-group">
            <div class="meal-head"><b>${label('meal', g.meal)}</b><span class="muted">${fmtNum(s.calories)} kcal · ${fmtNum(s.protein_g)} g protein <button class="link-btn small" type="button" data-copy-meal="${g.meal}" style="margin-left:8px">Copy meal</button></span></div>
            <div class="rows">${g.items.map((r) => html`<div class="row">
              ${r.photo_path && photos[r.photo_path] ? html`<img src="${photos[r.photo_path]}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px">` : ''}
              <div class="grow"><b>${r.food_name}</b><span>${r.quantity ? `${fmtNum(r.quantity, 1)} ${r.unit || ''} · ` : ''}P ${fmtNum(r.protein_g || 0)} · C ${fmtNum(r.carbs_g || 0)} · F ${fmtNum(r.fat_g || 0)}${r.notes ? ` · ${r.notes}` : ''}</span></div>
              <span class="num">${fmtNum(r.calories || 0)} kcal</span>
              <div class="actions">
                <button class="icon-btn" type="button" data-edit-food="${r.id}"><span class="sr-only">Edit ${r.food_name}</span>${raw(icon('edit'))}</button>
                <button class="icon-btn" type="button" data-dup-food="${r.id}"><span class="sr-only">Duplicate ${r.food_name}</span>${raw(icon('copy'))}</button>
                <button class="icon-btn" type="button" data-del-food="${r.id}"><span class="sr-only">Delete ${r.food_name}</span>${raw(icon('trash'))}</button>
              </div></div>`)}</div></div>`;
  }) : html`<div class="empty"><h3>Nothing logged for ${state.date === ymd() ? 'today' : fmtDate(state.date)}</h3><p>Add what you ate, or copy yesterday's meals if today looked similar.</p></div>`}
      </section>
      <div class="stack" style="--stack:16px">
        <section class="panel" aria-labelledby="wk-title">
          <div class="panel-head"><h3 id="wk-title">Last 7 days</h3><span class="small muted">${weekLogged.length} days logged</span></div>
          <ul class="kv">
            <li><span>Average calories</span><span>${weekLogged.length ? fmtNum(avg('calories')) : '-'} kcal</span></li>
            <li><span>Average protein</span><span>${weekLogged.length ? fmtNum(avg('protein')) : '-'} g</span></li>
            <li><span>Average carbs</span><span>${weekLogged.length ? fmtNum(avg('carbs')) : '-'} g</span></li>
            <li><span>Average fat</span><span>${weekLogged.length ? fmtNum(avg('fat')) : '-'} g</span></li>
          </ul>
          <table class="table" style="margin-top:12px"><thead><tr><th>Day</th><th class="num">kcal</th><th class="num">Protein</th></tr></thead>
            <tbody>${[...week].reverse().map((d) => html`<tr><td>${fmtDate(d.date, { weekday: 'short', day: 'numeric' })}</td><td class="num">${d.calories ? fmtNum(d.calories) : '-'}</td><td class="num">${d.protein ? `${fmtNum(d.protein)} g` : '-'}</td></tr>`)}</tbody></table>
        </section>
        <section class="panel" aria-labelledby="search-title">
          <div class="panel-head"><h3 id="search-title">Search past meals</h3></div>
          <input class="input" type="search" placeholder="e.g. paneer, oats" data-food-search aria-label="Search past meals">
          <div class="rows" data-food-results style="margin-top:10px"></div>
        </section>
        ${state.saved.length ? html`<section class="panel" aria-labelledby="fav-title">
          <div class="panel-head"><h3 id="fav-title">Frequent foods</h3></div>
          <div class="rows">${state.saved.slice(0, 8).map((s) => html`<div class="row"><div class="grow"><b>${s.name}</b><span>${s.quantity ? `${fmtNum(s.quantity, 1)} ${s.unit || ''} · ` : ''}${fmtNum(s.calories || 0)} kcal · P ${fmtNum(s.protein_g || 0)}</span></div>
            <button class="btn btn-ghost btn-sm" type="button" data-add-saved="${s.id}">Add</button>
            <button class="icon-btn" type="button" data-del-saved="${s.id}"><span class="sr-only">Remove ${s.name} from frequent foods</span>${raw(icon('x'))}</button></div>`)}</div>
        </section>` : ''}
      </div>
    </div>`);

  $('[data-add-food]').addEventListener('click', () => foodModal({}));
  $$('[data-edit-food]').forEach((b) => b.addEventListener('click', () => foodModal(rows.find((r) => r.id === b.dataset.editFood))));
  $$('[data-dup-food]').forEach((b) => b.addEventListener('click', () => duplicate([rows.find((r) => r.id === b.dataset.dupFood)])));
  $$('[data-copy-meal]').forEach((b) => b.addEventListener('click', () => duplicate(rows.filter((r) => r.meal === b.dataset.copyMeal))));
  $$('[data-del-food]').forEach((b) => b.addEventListener('click', async () => {
    const r = rows.find((x) => x.id === b.dataset.delFood);
    if (!(await confirmDialog({ title: 'Delete this entry?', body: `${r.food_name} (${fmtNum(r.calories || 0)} kcal) will be removed from ${fmtDate(r.log_date)}.` }))) return;
    try {
      await q(supa.from('food_logs').delete().eq('id', r.id));
      if (r.photo_path) await supa.storage.from('client-photos').remove([r.photo_path]);
      toast('Entry deleted'); renderFood();
    } catch (err) { toast(err.message, 'error'); }
  }));
  $('[data-copy-day]').addEventListener('click', async () => {
    const y = await q(supa.from('food_logs').select('*').eq('client_id', state.uid).eq('log_date', addDays(state.date, -1)));
    if (!y.length) { toast(`Nothing logged on ${fmtDate(addDays(state.date, -1))}.`, 'error'); return; }
    await copyRows(y, state.date);
  });
  $$('[data-add-saved]').forEach((b) => b.addEventListener('click', () => {
    const s = state.saved.find((x) => x.id === b.dataset.addSaved);
    foodModal({ meal: s.meal || guessMeal(), food_name: s.name, quantity: s.quantity, unit: s.unit, calories: s.calories, protein_g: s.protein_g, carbs_g: s.carbs_g, fat_g: s.fat_g, _new: true });
  }));
  $$('[data-del-saved]').forEach((b) => b.addEventListener('click', async () => {
    try { await q(supa.from('saved_foods').delete().eq('id', b.dataset.delSaved)); state.saved = state.saved.filter((s) => s.id !== b.dataset.delSaved); renderFood(); } catch (err) { toast(err.message, 'error'); }
  }));
  $('[data-food-search]').addEventListener('input', debounce(async (e) => {
    const term = e.target.value.trim();
    const out = $('[data-food-results]');
    if (term.length < 2) { setHTML(out, ''); return; }
    const res = await q(supa.from('food_logs').select('*').eq('client_id', state.uid).ilike('food_name', `%${term.replace(/[%_]/g, '')}%`).order('log_date', { ascending: false }).limit(15));
    setHTML(out, res.length ? res.map((r) => html`<div class="row"><div class="grow"><b>${r.food_name}</b><span>${fmtDate(r.log_date)} · ${label('meal', r.meal)} · ${fmtNum(r.calories || 0)} kcal</span></div><button class="btn btn-ghost btn-sm" type="button" data-again="${r.id}">Add to ${state.date === ymd() ? 'today' : fmtDate(state.date, { day: 'numeric', month: 'short' })}</button></div>`)
      : html`<p class="small muted">No past entries match.</p>`);
    $$('[data-again]', out).forEach((b) => b.addEventListener('click', () => copyRows([res.find((r) => r.id === b.dataset.again)], state.date)));
  }, 300));
}

const guessMeal = () => { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snack' : 'dinner'; };

async function copyRows(rows, toDate) {
  const copies = rows.map((r) => ({ client_id: state.uid, log_date: toDate, meal: r.meal, food_name: r.food_name, quantity: r.quantity, unit: r.unit, calories: r.calories, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, fiber_g: r.fiber_g, notes: r.notes }));
  try {
    await q(supa.from('food_logs').insert(copies));
    toast(`Added ${copies.length} item${copies.length > 1 ? 's' : ''} to ${toDate === ymd() ? 'today' : fmtDate(toDate)}`);
    if (toDate === state.date) renderFood();
  } catch (err) { toast(err.message, 'error'); }
}

function duplicate(rows) {
  openModal({
    title: rows.length > 1 ? `Copy ${label('meal', rows[0].meal).toLowerCase()}` : `Duplicate ${rows[0].food_name}`,
    body: html`<div class="field"><label for="dup-date">Copy to date</label><input class="input" id="dup-date" name="date" type="date" max="${ymd()}" value="${ymd()}"></div>`,
    submit: 'Copy',
    onSubmit: async (form) => { const d = form.elements.date.value; if (!d) throw new Error('Choose a date.'); await copyRows(rows, d); },
  });
}

function foodModal(r) {
  const isEdit = !!r.id;
  const opt = (v, cur, text) => html`<option value="${v}" ${v === cur ? raw('selected') : ''}>${text}</option>`;
  let base = null;
  const { form } = openModal({
    title: isEdit ? 'Edit food' : 'Add food',
    body: html`
      <div class="form-row">
        <div class="field"><label for="f-meal">Meal</label><select class="input" id="f-meal" name="meal">${MEALS.map((m) => opt(m, r.meal || guessMeal(), label('meal', m)))}</select></div>
        <div class="field"><label for="f-date">Date</label><input class="input" id="f-date" name="log_date" type="date" max="${ymd()}" value="${r.log_date || state.date}"></div>
      </div>
      <div class="field"><label for="f-name">Food</label><input class="input" id="f-name" name="food_name" list="food-options" required maxlength="120" value="${r.food_name || ''}" placeholder="Start typing: paneer, roti, dal..." autocomplete="off">
        <p class="hint">Pick a suggestion to fill in the numbers, then adjust the amount.</p><p class="field-error" data-error-for="food_name" id="fe-name"></p></div>
      <div class="form-row">
        <div class="field"><label for="f-qty">Amount</label><input class="input" id="f-qty" name="quantity" type="number" inputmode="decimal" step="any" min="0" value="${r.quantity ?? ''}"></div>
        <div class="field"><label for="f-unit">Unit</label><select class="input" id="f-unit" name="unit"><option value="">-</option>${UNITS.map((u) => opt(u, r.unit, u))}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="f-cal">Calories</label><input class="input" id="f-cal" name="calories" type="number" inputmode="decimal" min="0" max="5000" value="${r.calories ?? ''}"><p class="field-error" data-error-for="calories" id="fe-cal"></p></div>
        <div class="field"><label for="f-p">Protein (g)</label><input class="input" id="f-p" name="protein_g" type="number" inputmode="decimal" min="0" max="500" step="0.1" value="${r.protein_g ?? ''}"></div>
        <div class="field"><label for="f-c">Carbs (g)</label><input class="input" id="f-c" name="carbs_g" type="number" inputmode="decimal" min="0" max="1000" step="0.1" value="${r.carbs_g ?? ''}"></div>
        <div class="field"><label for="f-f">Fat (g)</label><input class="input" id="f-f" name="fat_g" type="number" inputmode="decimal" min="0" max="500" step="0.1" value="${r.fat_g ?? ''}"></div>
      </div>
      <div class="field"><label for="f-notes">Notes</label><input class="input" id="f-notes" name="notes" maxlength="500" value="${r.notes || ''}"></div>
      <div class="field"><label for="f-photo">Photo <span class="muted">(optional)</span></label><input class="input" id="f-photo" name="photo" type="file" accept="image/*" capture="environment"></div>
      <label class="check"><input type="checkbox" name="save_frequent" ${r._new ? '' : ''}> <span>Save to my frequent foods</span></label>`,
    submit: isEdit ? 'Save changes' : 'Add food',
    onSubmit: async (f) => {
      const e = f.elements;
      const row = {
        client_id: state.uid, log_date: e.log_date.value, meal: e.meal.value, food_name: e.food_name.value.trim(),
        quantity: numOrNull(e.quantity.value), unit: e.unit.value || null,
        calories: numOrNull(e.calories.value), protein_g: numOrNull(e.protein_g.value), carbs_g: numOrNull(e.carbs_g.value), fat_g: numOrNull(e.fat_g.value),
        notes: e.notes.value.trim() || null,
      };
      if (!row.food_name) throw new Error('Enter what you ate.');
      if (!row.log_date || row.log_date > ymd()) throw new Error('Choose a date up to today.');
      if (row.calories == null && row.protein_g == null) throw new Error('Enter at least calories or protein so it counts towards your totals.');
      for (const [k, max] of [['calories', 5000], ['protein_g', 500], ['carbs_g', 1000], ['fat_g', 500]]) if (row[k] != null && (row[k] < 0 || row[k] > max)) throw new Error(`Check the ${k.replace('_g', '')} value.`);
      const file = e.photo.files[0];
      if (file) {
        if (file.size > 15e6) throw new Error('Photo is too large (max 15 MB).');
        row.photo_path = await uploadOwn('client-photos', state.uid, await shrinkImage(file, 1200), 'food');
      }
      if (isEdit) {
        await q(supa.from('food_logs').update(row).eq('id', r.id));
        if (file && r.photo_path) await supa.storage.from('client-photos').remove([r.photo_path]);
      } else {
        await q(supa.from('food_logs').insert(row));
      }
      if (e.save_frequent.checked) {
        const fav = { client_id: state.uid, name: row.food_name, meal: row.meal, quantity: row.quantity, unit: row.unit, calories: row.calories, protein_g: row.protein_g, carbs_g: row.carbs_g, fat_g: row.fat_g };
        const existing = state.saved.find((s) => s.name.toLowerCase() === row.food_name.toLowerCase());
        if (existing) await q(supa.from('saved_foods').update({ ...fav, use_count: existing.use_count + 1 }).eq('id', existing.id));
        else await q(supa.from('saved_foods').insert(fav));
        state.saved = await q(supa.from('saved_foods').select('*').eq('client_id', state.uid).order('use_count', { ascending: false }));
      } else {
        const s = state.saved.find((x) => x.name.toLowerCase() === row.food_name.toLowerCase());
        if (s && !isEdit) supa.from('saved_foods').update({ use_count: s.use_count + 1 }).eq('id', s.id).then(() => {});
      }
      toast(isEdit ? 'Entry updated' : 'Food added');
      if (row.log_date !== state.date) { state.date = row.log_date; $('[data-date]').value = row.log_date; }
      renderFood();
    },
  });

  const e = form.elements;
  const setMacros = (src, factor = 1) => {
    const r1 = (v) => (v == null ? '' : String(Math.round(Number(v) * factor * 10) / 10));
    e.calories.value = src.calories == null ? '' : String(Math.round(Number(src.calories) * factor));
    e.protein_g.value = r1(src.protein_g); e.carbs_g.value = r1(src.carbs_g); e.fat_g.value = r1(src.fat_g);
  };
  e.food_name.addEventListener('change', () => {
    const name = e.food_name.value.trim().toLowerCase();
    const s = state.saved.find((x) => x.name.toLowerCase() === name);
    const f = state.foods.find((x) => x.name.toLowerCase() === name);
    if (s) { base = { qty: Number(s.quantity) || null, unit: s.unit, calories: s.calories, protein_g: s.protein_g, carbs_g: s.carbs_g, fat_g: s.fat_g }; if (s.meal) e.meal.value = s.meal; }
    else if (f) { base = { qty: Number(f.serving_g), unit: /ml/.test(f.serving_label) ? 'ml' : 'g', calories: f.calories, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, label: f.serving_label }; }
    else { base = null; return; }
    e.quantity.value = base.qty ?? ''; e.unit.value = base.unit || '';
    setMacros(base);
    if (base.label) toast(`Filled for ${base.label}. Change the amount to rescale.`);
  });
  e.quantity.addEventListener('input', () => {
    if (!base?.qty || e.unit.value !== (base.unit || '')) return;
    const qty = Number(e.quantity.value);
    if (qty > 0) setMacros(base, qty / base.qty);
  });
  void esc;
}

// =================================================================== WORKOUTS
async function loadPRs() {
  const all = await q(supa.from('workout_logs').select('id,exercise,log_date,weight_kg,reps,est_1rm').eq('client_id', state.uid).order('log_date').limit(5000));
  const prs = {};
  for (const r of all) {
    const k = r.exercise.trim().toLowerCase();
    const p = prs[k] || (prs[k] = { name: r.exercise, best1rm: null, bestWeight: null, bestId: null, date: null, sessions: 0 });
    p.sessions += 1;
    if (r.est_1rm != null && (p.best1rm == null || Number(r.est_1rm) > p.best1rm)) { p.best1rm = Number(r.est_1rm); p.bestId = r.id; p.date = r.log_date; }
    if (r.weight_kg != null && (p.bestWeight == null || Number(r.weight_kg) > p.bestWeight)) p.bestWeight = Number(r.weight_kg);
  }
  state.prs = prs;
  return all;
}

async function renderWorkouts() {
  const el = $('[data-workouts]');
  setHTML(el, html`<div class="skeleton" style="height:240px"></div>`);
  const [rows] = await Promise.all([
    q(supa.from('workout_logs').select('*').eq('client_id', state.uid).eq('log_date', state.date).order('created_at')),
    loadPRs(),
  ]);
  const names = [...new Set([...Object.values(state.prs).map((p) => p.name), ...state.exercises.map((x) => x.name), ...(state.plans.workout?.days || []).flatMap((d) => (d.exercises || []).map((x) => x.name))])].filter(Boolean).sort();
  const prList = Object.values(state.prs).filter((p) => p.best1rm || p.bestWeight).sort((a, b) => b.sessions - a.sessions).slice(0, 12);
  setHTML(el, html`
    <datalist id="exercise-options">${names.map((n) => html`<option value="${n}"></option>`)}</datalist>
    <div class="cluster" style="margin-bottom:18px">
      <button class="btn btn-primary btn-sm" type="button" data-add-ex>${raw(icon('plus'))} Add exercise</button>
      ${state.plans.workout?.days?.length ? html`<button class="btn btn-ghost btn-sm" type="button" data-from-plan>Log a session from my plan</button>` : ''}
    </div>
    <div class="panel-grid">
      <section class="panel" aria-label="Session">
        <div class="panel-head"><h3>${state.date === ymd() ? 'Today' : fmtDate(state.date, { weekday: 'long', day: 'numeric', month: 'short' })}</h3><span class="small muted">${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}</span></div>
        ${rows.length ? html`<div class="rows">${rows.map((r) => {
    const pr = state.prs[r.exercise.trim().toLowerCase()];
    const isPr = pr && pr.bestId === r.id && pr.sessions > 1;
    return html`<div class="row"><div class="grow"><b>${r.exercise}${isPr ? raw('<span class="pr">PR</span>') : ''}</b>
            <span>${[r.sets && r.reps ? `${r.sets} x ${r.reps}` : r.sets ? `${r.sets} sets` : '', r.weight_kg != null ? `${fmtNum(r.weight_kg, 1)} kg` : '', r.duration_min ? `${fmtNum(r.duration_min)} min` : '', r.est_1rm ? `est. 1RM ${fmtNum(r.est_1rm, 1)} kg` : '', r.notes || ''].filter(Boolean).join(' · ')}</span></div>
            <div class="actions">
              <button class="icon-btn" type="button" data-edit-ex="${r.id}"><span class="sr-only">Edit ${r.exercise}</span>${raw(icon('edit'))}</button>
              <button class="icon-btn" type="button" data-dup-ex="${r.id}"><span class="sr-only">Add another set of ${r.exercise}</span>${raw(icon('copy'))}</button>
              <button class="icon-btn" type="button" data-del-ex="${r.id}"><span class="sr-only">Delete ${r.exercise}</span>${raw(icon('trash'))}</button>
            </div></div>`;
  })}</div>` : html`<div class="empty"><h3>No workout logged</h3><p>Add exercises as you go, or log a whole session from your plan.</p></div>`}
      </section>
      <div class="stack" style="--stack:16px">
        <section class="panel" aria-labelledby="pr-title">
          <div class="panel-head"><h3 id="pr-title">Personal records</h3><a class="small" href="/portal/progress/#strength">Strength charts</a></div>
          ${prList.length ? html`<table class="table"><thead><tr><th>Exercise</th><th class="num">Heaviest</th><th class="num">Best est. 1RM</th></tr></thead>
            <tbody>${prList.map((p) => html`<tr><td>${p.name}</td><td class="num">${p.bestWeight != null ? `${fmtNum(p.bestWeight, 1)} kg` : '-'}</td><td class="num">${p.best1rm ? `${fmtNum(p.best1rm, 1)} kg` : '-'}</td></tr>`)}</tbody></table>
            <p class="small muted" style="margin:8px 0 0">Estimated 1RM uses the Epley formula on sets of 12 reps or fewer.</p>`
    : html`<p class="muted small">Log weights and reps to start tracking records.</p>`}
        </section>
        <section class="panel" aria-labelledby="hist-title">
          <div class="panel-head"><h3 id="hist-title">Exercise history</h3></div>
          <input class="input" list="exercise-options" placeholder="Choose an exercise" data-hist aria-label="Exercise history">
          <div data-hist-out style="margin-top:10px"></div>
        </section>
      </div>
    </div>`);

  $('[data-add-ex]').addEventListener('click', () => exerciseModal({}));
  $('[data-from-plan]')?.addEventListener('click', planSessionModal);
  $$('[data-edit-ex]').forEach((b) => b.addEventListener('click', () => exerciseModal(rows.find((r) => r.id === b.dataset.editEx))));
  $$('[data-dup-ex]').forEach((b) => b.addEventListener('click', () => { const r = rows.find((x) => x.id === b.dataset.dupEx); exerciseModal({ ...r, id: undefined }); }));
  $$('[data-del-ex]').forEach((b) => b.addEventListener('click', async () => {
    const r = rows.find((x) => x.id === b.dataset.delEx);
    if (!(await confirmDialog({ title: 'Delete this exercise?', body: `${r.exercise} on ${fmtDate(r.log_date)} will be removed.` }))) return;
    try { await q(supa.from('workout_logs').delete().eq('id', r.id)); toast('Deleted'); renderWorkouts(); } catch (err) { toast(err.message, 'error'); }
  }));
  $('[data-hist]').addEventListener('change', async (e) => {
    const name = e.target.value.trim();
    const out = $('[data-hist-out]');
    if (!name) { setHTML(out, ''); return; }
    const hist = await q(supa.from('workout_logs').select('*').eq('client_id', state.uid).ilike('exercise', name.replace(/[%_]/g, '')).order('log_date', { ascending: false }).limit(30));
    setHTML(out, hist.length ? html`<table class="table"><thead><tr><th>Date</th><th>Sets x reps</th><th class="num">kg</th></tr></thead><tbody>${hist.map((h) => html`<tr><td>${fmtDate(h.log_date, { day: 'numeric', month: 'short' })}</td><td>${h.sets || '-'} x ${h.reps || '-'}</td><td class="num">${h.weight_kg != null ? fmtNum(h.weight_kg, 1) : '-'}</td></tr>`)}</tbody></table>`
      : html`<p class="small muted">No history for ${name} yet.</p>`);
  });
}

function exerciseModal(r) {
  const isEdit = !!r.id;
  openModal({
    title: isEdit ? 'Edit exercise' : 'Add exercise',
    body: html`
      <div class="field"><label for="x-name">Exercise</label><input class="input" id="x-name" name="exercise" list="exercise-options" required maxlength="120" value="${r.exercise || ''}" autocomplete="off"></div>
      <div class="form-row">
        <div class="field"><label for="x-sets">Sets</label><input class="input" id="x-sets" name="sets" type="number" inputmode="numeric" min="1" max="30" value="${r.sets ?? ''}"></div>
        <div class="field"><label for="x-reps">Reps per set</label><input class="input" id="x-reps" name="reps" type="number" inputmode="numeric" min="1" max="200" value="${r.reps ?? ''}"></div>
        <div class="field"><label for="x-kg">Weight</label><div class="input-group"><input class="input" id="x-kg" name="weight_kg" type="number" inputmode="decimal" min="0" max="500" step="0.25" value="${r.weight_kg ?? ''}"><span class="suffix">kg</span></div></div>
        <div class="field"><label for="x-min">Duration</label><div class="input-group"><input class="input" id="x-min" name="duration_min" type="number" inputmode="decimal" min="0" max="600" value="${r.duration_min ?? ''}"><span class="suffix">min</span></div></div>
      </div>
      <div class="field"><label for="x-date">Date</label><input class="input" id="x-date" name="log_date" type="date" max="${ymd()}" value="${r.log_date || state.date}"></div>
      <div class="field"><label for="x-notes">Notes</label><input class="input" id="x-notes" name="notes" maxlength="500" value="${r.notes || ''}" placeholder="How it felt, form cues, RPE"></div>
      <p class="hint">Different weights across sets? Add one entry per weight. Bodyweight exercises: leave weight blank.</p>`,
    submit: isEdit ? 'Save changes' : 'Add exercise',
    onSubmit: async (f) => {
      const e = f.elements;
      const row = { client_id: state.uid, log_date: e.log_date.value, exercise: e.exercise.value.trim(), sets: intOrNull(e.sets.value), reps: intOrNull(e.reps.value), weight_kg: numOrNull(e.weight_kg.value), duration_min: numOrNull(e.duration_min.value), notes: e.notes.value.trim() || null };
      if (!row.exercise) throw new Error('Enter the exercise name.');
      if (!row.log_date || row.log_date > ymd()) throw new Error('Choose a date up to today.');
      if (!row.sets && !row.reps && !row.duration_min) throw new Error('Enter sets and reps, or a duration.');
      if (row.sets != null && (row.sets < 1 || row.sets > 30)) throw new Error('Sets must be between 1 and 30.');
      if (row.reps != null && (row.reps < 1 || row.reps > 200)) throw new Error('Reps must be between 1 and 200.');
      if (row.weight_kg != null && (row.weight_kg < 0 || row.weight_kg > 500)) throw new Error('Weight must be between 0 and 500 kg.');
      if (isEdit) await q(supa.from('workout_logs').update(row).eq('id', r.id));
      else await q(supa.from('workout_logs').insert(row));
      const prev = state.prs[row.exercise.toLowerCase()];
      const e1 = row.weight_kg > 0 && row.reps >= 1 && row.reps <= 12 ? row.weight_kg * (1 + row.reps / 30) : null;
      toast(!isEdit && prev?.best1rm && e1 && e1 > prev.best1rm ? `New personal record on ${row.exercise}!` : isEdit ? 'Updated' : 'Exercise added');
      if (row.log_date !== state.date) { state.date = row.log_date; $('[data-date]').value = row.log_date; }
      renderWorkouts();
    },
  });
}

function planSessionModal() {
  const days = state.plans.workout.days;
  const firstNum = (s) => { const m = String(s ?? '').match(/\d+/); return m ? Number(m[0]) : ''; };
  const { form } = openModal({
    title: 'Log a session from your plan',
    wide: true,
    body: html`
      <div class="field"><label for="ps-day">Which day?</label><select class="input" id="ps-day" name="day">${days.map((d, i) => html`<option value="${i}">${d.name || `Day ${i + 1}`}</option>`)}</select></div>
      <div data-ps-rows></div>
      <p class="hint">Fill in what you actually did. Rows left empty are skipped.</p>`,
    submit: 'Save session',
    onSubmit: async (f) => {
      const rowsEl = $$('[data-ps-row]', f);
      const inserts = rowsEl.map((r) => ({
        client_id: state.uid, log_date: state.date, exercise: r.dataset.name,
        sets: intOrNull($('[name="s"]', r).value), reps: intOrNull($('[name="r"]', r).value), weight_kg: numOrNull($('[name="w"]', r).value),
      })).filter((x) => x.sets || x.reps || x.weight_kg != null);
      if (!inserts.length) throw new Error('Fill in at least one exercise.');
      await q(supa.from('workout_logs').insert(inserts));
      const daily = await q(supa.from('daily_logs').select('id').eq('client_id', state.uid).eq('log_date', state.date).maybeSingle());
      if (daily) await supa.from('daily_logs').update({ workout_done: true }).eq('id', daily.id);
      else await supa.from('daily_logs').insert({ client_id: state.uid, log_date: state.date, workout_done: true });
      toast(`Logged ${inserts.length} exercises`);
      renderWorkouts();
    },
  });
  const draw = () => {
    const d = days[Number(form.elements.day.value)];
    setHTML($('[data-ps-rows]', form), html`<div class="table-wrap"><table class="table"><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>kg</th></tr></thead><tbody>
      ${(d.exercises || []).map((x) => html`<tr data-ps-row data-name="${x.name}"><td><b>${x.name}</b><div class="small muted">Plan: ${x.sets || '-'} x ${x.reps || '-'}${x.rest ? `, rest ${x.rest}` : ''}</div></td>
        <td><input class="input" name="s" type="number" min="1" max="30" value="${firstNum(x.sets)}" style="min-height:40px;width:70px" aria-label="Sets"></td>
        <td><input class="input" name="r" type="number" min="1" max="200" value="${firstNum(x.reps)}" style="min-height:40px;width:70px" aria-label="Reps"></td>
        <td><input class="input" name="w" type="number" min="0" max="500" step="0.25" style="min-height:40px;width:84px" aria-label="Weight in kg"></td></tr>`)}
    </tbody></table></div>`);
  };
  form.elements.day.addEventListener('change', draw);
  draw();
}

// ================================================================== CHECKLIST
async function renderChecklist() {
  const el = $('[data-checklist]');
  const days = (await loadDays(state.uid, addDays(state.date, -13), state.date)).reverse();
  const t = state.t;
  const custom = state.plans.targets?.custom_log_fields || [];
  setHTML(el, html`
    <p class="muted">Steps, water, sleep and whether you trained. Calories and protein come from your food log, or you can enter daily totals here.</p>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Day</th><th>Workout</th><th class="num">Steps</th><th class="num">Water</th><th class="num">Sleep</th><th class="num">kcal</th><th class="num">Protein</th>${custom.map((c) => html`<th>${c.label}</th>`)}<th><span class="sr-only">Edit</span></th></tr></thead>
      <tbody>${days.map((d) => html`<tr>
        <td>${fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
        <td>${d.workout ? 'Yes' : d.daily ? 'No' : '-'}</td>
        <td class="num">${d.steps != null ? fmtNum(d.steps) : '-'}</td>
        <td class="num">${d.water != null ? `${fmtNum(d.water / 1000, 1)} L` : '-'}</td>
        <td class="num">${d.sleep != null ? `${fmtNum(d.sleep, 1)} h` : '-'}</td>
        <td class="num">${d.calories ? fmtNum(d.calories) : '-'}</td>
        <td class="num">${d.protein ? `${fmtNum(d.protein)} g` : '-'}</td>
        ${custom.map((c) => html`<td>${d.daily?.custom_data?.[c.key] ?? '-'}</td>`)}
        <td><button class="btn btn-quiet btn-sm" type="button" data-edit-day="${d.date}">Edit</button></td></tr>`)}</tbody>
    </table></div>
    <p class="small muted" style="margin-top:10px">Targets: ${fmtNum(t.steps)} steps, ${fmtNum(t.water / 1000, 1)} L water, ${t.sleep} h sleep.</p>`);
  $$('[data-edit-day]').forEach((b) => b.addEventListener('click', () => {
    const d = days.find((x) => x.date === b.dataset.editDay);
    openQuickLog({ clientId: state.uid, date: d.date, targets: t, plan: state.plans.targets, foodEntries: d.foodEntries, onSaved: renderChecklist });
  }));
}

// Start last, so every module-level constant above is initialised first.
const ctx = await mountPortal({ active: 'logs', title: 'Food and workouts' });
if (ctx) init(ctx).catch((err) => setHTML(ctx.content, html`<div class="notice danger">Could not load your logs. ${err.message}</div>`));
