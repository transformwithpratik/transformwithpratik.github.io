// Plan tab in the client detail: targets, structured training plan and nutrition plan.
// Everything is stored as data, so plans change without touching code.
import { q, supa } from './shell.js';
import { $, $$, html, raw, setHTML, toast, busy, intOrNull, numOrNull, fmtDate, ymd, slugify, confirmDialog } from '../lib/util.js';
import { openModal } from '../lib/portal.js';
import { signedUrl } from '../lib/supabase.js';
import { calorieTargets, ACTIVITY, GOALS } from '../lib/calc.js';

export async function renderPlanTab(el, c) {
  const [targets, workout, nutrition, exercises, others, latestW] = await Promise.all([
    q(supa.from('plans').select('*').eq('client_id', c.id).eq('is_active', true).maybeSingle()),
    q(supa.from('workout_plans').select('*').eq('client_id', c.id).eq('is_active', true).maybeSingle()),
    q(supa.from('nutrition_plans').select('*').eq('client_id', c.id).eq('is_active', true).maybeSingle()),
    q(supa.from('exercises').select('name,video_url').order('name')),
    q(supa.from('profiles').select('id,full_name').eq('role', 'client').neq('id', c.id).order('full_name')),
    q(supa.from('progress_records').select('weight_kg').eq('client_id', c.id).not('weight_kg', 'is', null).order('record_date', { ascending: false }).limit(1).maybeSingle()),
  ]);
  const t = targets || {};
  const pdfUrl = t.pdf_url ? await signedUrl('client-plans', t.pdf_url) : '';
  const W = { title: workout?.title || 'Training plan', starts_on: workout?.starts_on || '', notes: workout?.notes || '', days: structuredClone(workout?.days || []) };
  const N = { title: nutrition?.title || 'Nutrition plan', notes: nutrition?.notes || '', restrictions: nutrition?.restrictions || '', meals: structuredClone(nutrition?.meals || []), substitutions: structuredClone(nutrition?.substitutions || []) };
  let custom = structuredClone(t.custom_log_fields || []);

  setHTML(el, html`
    <datalist id="pb-ex">${exercises.map((x) => html`<option value="${x.name}"></option>`)}</datalist>
    <section class="panel"><div class="panel-head"><h3>Daily targets</h3><button class="btn btn-quiet btn-sm" type="button" data-suggest>Suggest from calculator</button></div>
      <form class="form" data-targets>
        <div class="form-row">
          ${[['daily_calories', 'Calories', 'kcal', 800, 6000], ['protein_g', 'Protein', 'g', 0, 400], ['carbs_g', 'Carbs', 'g', 0, 900], ['fat_g', 'Fat', 'g', 0, 300], ['fiber_g', 'Fibre', 'g', 0, 100]].map(([k, l, u, lo, hi]) => html`<div class="field"><label for="pt-${k}">${l}</label><div class="input-group"><input class="input" id="pt-${k}" name="${k}" type="number" min="${lo}" max="${hi}" value="${t[k] ?? ''}"><span class="suffix">${u}</span></div></div>`)}
        </div>
        <div class="form-row">
          <div class="field"><label for="pt-steps">Steps</label><input class="input" id="pt-steps" name="steps_target" type="number" min="0" max="50000" value="${t.steps_target ?? 8000}"></div>
          <div class="field"><label for="pt-water">Water</label><div class="input-group"><input class="input" id="pt-water" name="water_ml_target" type="number" min="0" max="8000" step="250" value="${t.water_ml_target ?? ''}" placeholder="2500"><span class="suffix">ml</span></div></div>
          <div class="field"><label for="pt-sleep">Sleep</label><div class="input-group"><input class="input" id="pt-sleep" name="sleep_hours_target" type="number" min="4" max="12" step="0.5" value="${t.sleep_hours_target ?? ''}" placeholder="7"><span class="suffix">hrs</span></div></div>
        </div>
        <p class="small muted" data-macro-check></p>
        <div class="field"><label for="pt-notes">Note to client (shown with their targets)</label><textarea class="input" id="pt-notes" name="coach_notes" maxlength="2000">${t.coach_notes || ''}</textarea></div>
        <details><summary class="small" style="cursor:pointer;color:var(--lime)">Free-text plan sections (from the original portal)</summary>
          <div class="field" style="margin-top:10px"><label for="pt-ws">Workout split</label><textarea class="input" id="pt-ws" name="workout_split">${t.workout_split || ''}</textarea></div>
          <div class="field"><label for="pt-do">Diet overview</label><textarea class="input" id="pt-do" name="diet_overview">${t.diet_overview || ''}</textarea></div>
          <div class="field"><label for="pt-sup">Supplements</label><textarea class="input" id="pt-sup" name="supplements">${t.supplements || ''}</textarea></div>
        </details>
        <fieldset><legend>Extra daily fields for this client <span class="muted small">(appear in their daily checklist)</span></legend><div data-custom></div>
          <button class="btn btn-quiet btn-sm" type="button" data-add-custom>Add field</button></fieldset>
        <div class="field"><label for="pt-pdf">Plan PDF ${pdfUrl ? html`<a class="small" href="${pdfUrl}" target="_blank" rel="noopener">(current file)</a>` : ''}</label><input class="input" id="pt-pdf" name="pdf" type="file" accept="application/pdf"></div>
        <button class="btn btn-primary btn-sm" type="submit">Save targets</button>
      </form></section>

    <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Training plan</h3>
      <div class="cluster"><select class="input" data-copy-w style="min-height:36px;width:auto" aria-label="Copy training plan from"><option value="">Copy from another client</option>${others.map((o) => html`<option value="${o.id}">${o.full_name || o.id.slice(0, 8)}</option>`)}</select>
      ${workout ? html`<button class="btn btn-quiet btn-sm" type="button" data-archive-w>Archive</button>` : ''}</div></div>
      <form class="form" data-wform>
        <div class="form-row"><div class="field"><label for="w-title">Title</label><input class="input" id="w-title" name="title" value="${W.title}" maxlength="120"></div>
          <div class="field"><label for="w-start">Starts on</label><input class="input" id="w-start" name="starts_on" type="date" value="${W.starts_on}"></div></div>
        <div class="field"><label for="w-notes">Notes (warm-up, progression rules, cardio)</label><textarea class="input" id="w-notes" name="notes" maxlength="4000">${W.notes}</textarea></div>
        <div data-days></div>
        <div class="cluster"><button class="btn btn-ghost btn-sm" type="button" data-add-day>Add training day</button><button class="btn btn-primary btn-sm" type="submit">Save training plan</button></div>
      </form></section>

    <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Nutrition plan</h3>
      <div class="cluster"><select class="input" data-copy-n style="min-height:36px;width:auto" aria-label="Copy nutrition plan from"><option value="">Copy from another client</option>${others.map((o) => html`<option value="${o.id}">${o.full_name || o.id.slice(0, 8)}</option>`)}</select>
      ${nutrition ? html`<button class="btn btn-quiet btn-sm" type="button" data-archive-n>Archive</button>` : ''}</div></div>
      <form class="form" data-nform>
        <div class="form-row"><div class="field"><label for="n-title">Title</label><input class="input" id="n-title" name="title" value="${N.title}" maxlength="120"></div>
          <div class="field"><label for="n-res">Dietary restrictions</label><input class="input" id="n-res" name="restrictions" value="${N.restrictions}" maxlength="1000" placeholder="e.g. Jain, no onion or garlic; lactose intolerant"></div></div>
        <div class="field"><label for="n-notes">Notes</label><textarea class="input" id="n-notes" name="notes" maxlength="4000">${N.notes}</textarea></div>
        <div data-meals></div>
        <button class="btn btn-ghost btn-sm" type="button" data-add-meal>Add meal</button>
        <fieldset><legend>Food substitutions</legend><div data-subs></div><button class="btn btn-quiet btn-sm" type="button" data-add-sub>Add swap</button></fieldset>
        <button class="btn btn-primary btn-sm" type="submit">Save nutrition plan</button>
      </form></section>`);

  // ---------------- Targets
  const tf = $('[data-targets]', el);
  const macroCheck = () => {
    const f = tf.elements; const k = intOrNull(f.daily_calories.value); const p = intOrNull(f.protein_g.value) || 0; const cb = intOrNull(f.carbs_g.value) || 0; const ft = intOrNull(f.fat_g.value) || 0;
    const sum = p * 4 + cb * 4 + ft * 9;
    $('[data-macro-check]', el).textContent = k && sum ? `Macros add up to ${sum} kcal (${sum - k >= 0 ? '+' : ''}${sum - k} vs calorie target).` : '';
  };
  tf.addEventListener('input', macroCheck); macroCheck();
  const drawCustom = () => setHTML($('[data-custom]', el), custom.map((f, i) => html`<div class="cluster" style="margin-bottom:8px">
    <input class="input" data-cf="${i}" data-k="label" value="${f.label}" placeholder="Label, e.g. Water (L)" style="flex:2;min-height:40px" aria-label="Field label">
    <select class="input" data-cf="${i}" data-k="type" style="flex:1;min-height:40px" aria-label="Field type"><option value="number" ${f.type === 'number' ? raw('selected') : ''}>Number</option><option value="text" ${f.type !== 'number' ? raw('selected') : ''}>Text</option></select>
    <button class="icon-btn" type="button" data-rm-cf="${i}"><span class="sr-only">Remove field</span>&times;</button></div>`));
  const readCustom = () => { $$('[data-cf]', el).forEach((inp) => { custom[inp.dataset.cf][inp.dataset.k] = inp.value; }); custom = custom.filter((f) => f.label?.trim()).map((f) => ({ ...f, key: f.key || slugify(f.label).replace(/-/g, '_') || `field_${Date.now()}` })); };
  drawCustom();
  $('[data-add-custom]', el).addEventListener('click', () => { readCustom(); custom.push({ label: '', type: 'number' }); drawCustom(); });
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-rm-cf]'); if (b) { readCustom(); custom.splice(Number(b.dataset.rmCf), 1); drawCustom(); } });
  tf.addEventListener('submit', (e) => {
    e.preventDefault();
    readCustom();
    const f = tf.elements;
    const row = {
      client_id: c.id, is_active: true, daily_calories: intOrNull(f.daily_calories.value), protein_g: intOrNull(f.protein_g.value), carbs_g: intOrNull(f.carbs_g.value), fat_g: intOrNull(f.fat_g.value), fiber_g: intOrNull(f.fiber_g.value),
      steps_target: intOrNull(f.steps_target.value), water_ml_target: intOrNull(f.water_ml_target.value), sleep_hours_target: numOrNull(f.sleep_hours_target.value),
      coach_notes: f.coach_notes.value.trim() || null, workout_split: f.workout_split.value.trim() || null, diet_overview: f.diet_overview.value.trim() || null, supplements: f.supplements.value.trim() || null,
      custom_log_fields: custom,
    };
    if (row.daily_calories != null && (row.daily_calories < 800 || row.daily_calories > 6000)) { toast('Calories must be between 800 and 6000.', 'error'); return; }
    busy(tf.querySelector('[type="submit"]'), async () => {
      try {
        const file = f.pdf.files[0];
        if (file) {
          if (file.size > 25e6) throw new Error('PDF must be under 25 MB.');
          const path = `${c.id}/${Date.now()}-plan.pdf`;
          const { error } = await supa.storage.from('client-plans').upload(path, file, { contentType: 'application/pdf' });
          if (error) throw new Error(error.message);
          row.pdf_url = path;
        }
        if (targets) await q(supa.from('plans').update(row).eq('id', targets.id));
        else await q(supa.from('plans').insert(row));
        toast('Targets saved. The client has been notified.');
        renderPlanTab(el, c);
      } catch (err) { toast(err.message, 'error'); }
    });
  });
  $('[data-suggest]', el).addEventListener('click', () => suggestModal(c, latestW?.weight_kg, tf, macroCheck));

  // ---------------- Workout builder
  const readW = () => {
    const f = $('[data-wform]', el).elements;
    W.title = f.title.value; W.starts_on = f.starts_on.value; W.notes = f.notes.value;
    W.days = $$('[data-day]', el).map((d) => ({
      name: $('[data-dn]', d).value, focus: $('[data-df]', d).value,
      exercises: $$('[data-exrow]', d).map((r) => Object.fromEntries(['name', 'sets', 'reps', 'rest', 'notes', 'video_url', 'substitutions'].map((k) => [k, $(`[data-x="${k}"]`, r).value.trim()]))).filter((x) => x.name),
    }));
  };
  const drawW = () => setHTML($('[data-days]', el), W.days.length ? W.days.map((d, i) => html`<div class="builder-day" data-day="${i}">
    <div class="cluster"><input class="input" data-dn value="${d.name || `Day ${i + 1}`}" style="flex:1;min-height:40px" aria-label="Day name"><input class="input" data-df value="${d.focus || ''}" placeholder="Focus, e.g. Upper body" style="flex:1;min-height:40px" aria-label="Focus">
      <button class="btn btn-quiet btn-sm" type="button" data-mv-day="${i}" data-dir="-1" ${i === 0 ? raw('disabled') : ''}>Up</button><button class="btn btn-quiet btn-sm" type="button" data-rm-day="${i}">Remove day</button></div>
    ${(d.exercises || []).map((x, j) => html`<div class="builder-row" data-exrow>
      <input class="input" data-x="name" list="pb-ex" value="${x.name || ''}" placeholder="Exercise" aria-label="Exercise">
      <input class="input" data-x="sets" value="${x.sets || ''}" placeholder="Sets" aria-label="Sets">
      <input class="input" data-x="reps" value="${x.reps || ''}" placeholder="Reps, e.g. 8-12" aria-label="Reps">
      <input class="input" data-x="rest" value="${x.rest || ''}" placeholder="Rest" aria-label="Rest">
      <input class="input" data-x="notes" value="${x.notes || ''}" placeholder="Instructions or cues" aria-label="Instructions">
      <button class="icon-btn" type="button" data-rm-ex="${i}:${j}"><span class="sr-only">Remove exercise</span>&times;</button>
      <input class="input" data-x="substitutions" value="${x.substitutions || ''}" placeholder="Substitutions" aria-label="Substitutions" style="grid-column:1/4">
      <input class="input" data-x="video_url" value="${x.video_url || ''}" placeholder="Demo video URL (optional; library video is used if blank)" aria-label="Video URL" style="grid-column:4/-1">
    </div>`)}
    <button class="btn btn-quiet btn-sm" type="button" data-add-ex="${i}" style="margin-top:8px">Add exercise</button></div>`)
    : html`<p class="muted small">No training days yet. Add a day, then its exercises.</p>`);
  drawW();
  $('[data-add-day]', el).addEventListener('click', () => { readW(); W.days.push({ name: `Day ${W.days.length + 1}`, focus: '', exercises: [{ name: '', sets: '3', reps: '8-12', rest: '90 s' }] }); drawW(); });
  $('[data-days]', el).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    readW();
    if (b.dataset.addEx) W.days[b.dataset.addEx].exercises.push({ name: '', sets: '3', reps: '8-12', rest: '90 s' });
    else if (b.dataset.rmEx) { const [i, j] = b.dataset.rmEx.split(':').map(Number); W.days[i].exercises.splice(j, 1); }
    else if (b.dataset.rmDay) W.days.splice(Number(b.dataset.rmDay), 1);
    else if (b.dataset.mvDay) { const i = Number(b.dataset.mvDay); [W.days[i - 1], W.days[i]] = [W.days[i], W.days[i - 1]]; }
    else return;
    drawW();
  });
  $('[data-wform]', el).addEventListener('submit', (e) => {
    e.preventDefault(); readW();
    if (!W.days.length) { toast('Add at least one training day.', 'error'); return; }
    const row = { client_id: c.id, title: W.title.trim() || 'Training plan', starts_on: W.starts_on || null, notes: W.notes.trim() || null, days: W.days, is_active: true };
    busy(e.target.querySelector('[type="submit"]'), async () => {
      try { if (workout) await q(supa.from('workout_plans').update(row).eq('id', workout.id)); else await q(supa.from('workout_plans').insert(row)); toast('Training plan saved. The client has been notified.'); renderPlanTab(el, c); } catch (err) { toast(err.message, 'error'); }
    });
  });

  // ---------------- Nutrition builder
  const readN = () => {
    const f = $('[data-nform]', el).elements;
    N.title = f.title.value; N.notes = f.notes.value; N.restrictions = f.restrictions.value;
    N.meals = $$('[data-meal]', el).map((m) => ({
      name: $('[data-m="name"]', m).value.trim(), time: $('[data-m="time"]', m).value.trim(),
      calories: intOrNull($('[data-m="calories"]', m).value), protein_g: intOrNull($('[data-m="protein_g"]', m).value), notes: $('[data-m="notes"]', m).value.trim(),
      items: $$('[data-item]', m).map((it) => ({ food: $('[data-i="food"]', it).value.trim(), quantity: $('[data-i="quantity"]', it).value.trim() })).filter((x) => x.food),
    }));
    N.substitutions = $$('[data-sub]', el).map((s) => ({ swap: $('[data-s="swap"]', s).value.trim(), with: $('[data-s="with"]', s).value.trim() })).filter((s) => s.swap && s.with);
  };
  const drawN = () => {
    setHTML($('[data-meals]', el), N.meals.length ? N.meals.map((m, i) => html`<div class="builder-day" data-meal="${i}">
      <div class="form-row"><input class="input" data-m="name" value="${m.name || ''}" placeholder="Meal, e.g. Breakfast" aria-label="Meal name" style="min-height:40px">
        <input class="input" data-m="time" value="${m.time || ''}" placeholder="Time, e.g. 8:30 am" aria-label="Time" style="min-height:40px">
        <input class="input" data-m="calories" type="number" value="${m.calories ?? ''}" placeholder="kcal" aria-label="Calories" style="min-height:40px">
        <input class="input" data-m="protein_g" type="number" value="${m.protein_g ?? ''}" placeholder="Protein g" aria-label="Protein" style="min-height:40px"></div>
      ${(m.items || []).map((it, j) => html`<div class="cluster" data-item style="margin-top:8px"><input class="input" data-i="food" value="${it.food}" placeholder="Food" style="flex:2;min-height:40px" aria-label="Food"><input class="input" data-i="quantity" value="${it.quantity || ''}" placeholder="Quantity, e.g. 100 g" style="flex:1;min-height:40px" aria-label="Quantity"><button class="icon-btn" type="button" data-rm-item="${i}:${j}"><span class="sr-only">Remove food</span>&times;</button></div>`)}
      <input class="input" data-m="notes" value="${m.notes || ''}" placeholder="Notes or options" aria-label="Meal notes" style="margin-top:8px;min-height:40px">
      <div class="cluster" style="margin-top:8px"><button class="btn btn-quiet btn-sm" type="button" data-add-item="${i}">Add food</button><button class="btn btn-quiet btn-sm" type="button" data-rm-meal="${i}">Remove meal</button></div></div>`)
      : html`<p class="muted small">No meals yet.</p>`);
    setHTML($('[data-subs]', el), N.substitutions.map((s, i) => html`<div class="cluster" data-sub style="margin-bottom:8px"><input class="input" data-s="swap" value="${s.swap}" placeholder="Instead of, e.g. 100 g paneer" style="flex:1;min-height:40px" aria-label="Instead of"><input class="input" data-s="with" value="${s.with}" placeholder="Have, e.g. 150 g tofu or 3 eggs" style="flex:1;min-height:40px" aria-label="Swap with"><button class="icon-btn" type="button" data-rm-sub="${i}"><span class="sr-only">Remove swap</span>&times;</button></div>`));
  };
  drawN();
  $('[data-add-meal]', el).addEventListener('click', () => { readN(); N.meals.push({ name: ['Breakfast', 'Lunch', 'Evening snack', 'Dinner'][N.meals.length] || 'Meal', items: [{ food: '', quantity: '' }] }); drawN(); });
  $('[data-add-sub]', el).addEventListener('click', () => { readN(); N.substitutions.push({ swap: '', with: '' }); drawN(); });
  $('[data-nform]', el).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.type === 'submit') return;
    if (!(b.dataset.addItem || b.dataset.rmItem || b.dataset.rmMeal || b.dataset.rmSub)) return;
    readN();
    if (b.dataset.addItem) N.meals[b.dataset.addItem].items.push({ food: '', quantity: '' });
    else if (b.dataset.rmItem) { const [i, j] = b.dataset.rmItem.split(':').map(Number); N.meals[i].items.splice(j, 1); }
    else if (b.dataset.rmMeal) N.meals.splice(Number(b.dataset.rmMeal), 1);
    else if (b.dataset.rmSub) N.substitutions.splice(Number(b.dataset.rmSub), 1);
    drawN();
  });
  $('[data-nform]', el).addEventListener('submit', (e) => {
    e.preventDefault(); readN();
    if (!N.meals.length) { toast('Add at least one meal.', 'error'); return; }
    const row = { client_id: c.id, title: N.title.trim() || 'Nutrition plan', notes: N.notes.trim() || null, restrictions: N.restrictions.trim() || null, meals: N.meals, substitutions: N.substitutions, is_active: true };
    busy(e.target.querySelector('[type="submit"]'), async () => {
      try { if (nutrition) await q(supa.from('nutrition_plans').update(row).eq('id', nutrition.id)); else await q(supa.from('nutrition_plans').insert(row)); toast('Nutrition plan saved. The client has been notified.'); renderPlanTab(el, c); } catch (err) { toast(err.message, 'error'); }
    });
  });

  // ---------------- Copy and archive
  $('[data-copy-w]', el).addEventListener('change', async (e) => {
    if (!e.target.value) return;
    const src = await q(supa.from('workout_plans').select('*').eq('client_id', e.target.value).eq('is_active', true).maybeSingle());
    if (!src) { toast('That client has no active training plan.', 'error'); e.target.value = ''; return; }
    W.title = src.title; W.notes = src.notes || ''; W.days = structuredClone(src.days);
    $('[data-wform]', el).elements.title.value = W.title; $('[data-wform]', el).elements.notes.value = W.notes;
    drawW(); toast('Copied. Review and save to assign it.'); e.target.value = '';
  });
  $('[data-copy-n]', el).addEventListener('change', async (e) => {
    if (!e.target.value) return;
    const src = await q(supa.from('nutrition_plans').select('*').eq('client_id', e.target.value).eq('is_active', true).maybeSingle());
    if (!src) { toast('That client has no active nutrition plan.', 'error'); e.target.value = ''; return; }
    Object.assign(N, { title: src.title, notes: src.notes || '', restrictions: src.restrictions || '', meals: structuredClone(src.meals), substitutions: structuredClone(src.substitutions || []) });
    const f = $('[data-nform]', el).elements; f.title.value = N.title; f.notes.value = N.notes; f.restrictions.value = N.restrictions;
    drawN(); toast('Copied. Review and save to assign it.'); e.target.value = '';
  });
  $('[data-archive-w]', el)?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Archive training plan?', body: 'It disappears from the client\'s portal but is kept in the database. You can then build a new one.', confirm: 'Archive', danger: false }))) return;
    await q(supa.from('workout_plans').update({ is_active: false }).eq('id', workout.id)); renderPlanTab(el, c);
  });
  $('[data-archive-n]', el)?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Archive nutrition plan?', body: 'It disappears from the client\'s portal but is kept in the database.', confirm: 'Archive', danger: false }))) return;
    await q(supa.from('nutrition_plans').update({ is_active: false }).eq('id', nutrition.id)); renderPlanTab(el, c);
  });
}

function suggestModal(c, weight, tf, after) {
  const age = c.date_of_birth ? Math.floor((Date.now() - new Date(c.date_of_birth)) / 3.15576e10) : '';
  const { form } = openModal({
    title: 'Suggest targets',
    body: html`<p class="small muted" style="margin:0">Mifflin-St Jeor with the same rules as the public calculator. Review before saving.</p>
      <div class="form-row"><div class="field"><label for="sg-sex">Sex</label><select class="input" id="sg-sex" name="sex"><option value="male" ${c.sex === 'female' ? '' : raw('selected')}>Male</option><option value="female" ${c.sex === 'female' ? raw('selected') : ''}>Female</option></select></div>
        <div class="field"><label for="sg-age">Age</label><input class="input" id="sg-age" name="age" type="number" value="${age}"></div></div>
      <div class="form-row"><div class="field"><label for="sg-h">Height (cm)</label><input class="input" id="sg-h" name="height" type="number" value="${c.height_cm ?? ''}"></div>
        <div class="field"><label for="sg-w">Weight (kg)</label><input class="input" id="sg-w" name="weight" type="number" step="0.1" value="${weight ?? c.start_weight ?? ''}"></div></div>
      <div class="field"><label for="sg-a">Activity</label><select class="input" id="sg-a" name="activity">${ACTIVITY.map((a) => html`<option value="${a.key}" ${a.key === 'light' ? raw('selected') : ''}>${a.label}</option>`)}</select></div>
      <div class="field"><label for="sg-g">Goal</label><select class="input" id="sg-g" name="goal">${Object.entries(GOALS).map(([k, g]) => html`<option value="${k}" ${(c.goal === 'muscle_gain' ? 'gain' : c.goal === 'fat_loss' ? 'lose' : 'maintain') === k ? raw('selected') : ''}>${g.label}</option>`)}</select></div>
      <p class="small" data-sg-out></p>`,
    submit: 'Use these numbers',
    onSubmit: async (f) => {
      const r = calc(f);
      if (!r.ok) throw new Error(Object.values(r.errors)[0]);
      const t = tf.elements;
      t.daily_calories.value = r.target; t.protein_g.value = r.protein; t.carbs_g.value = r.carbs; t.fat_g.value = r.fat;
      after(); toast('Filled in. Save targets to apply.');
    },
  });
  const calc = (f) => calorieTargets({ sex: f.elements.sex.value, age: Number(f.elements.age.value), heightCm: Number(f.elements.height.value), weightKg: Number(f.elements.weight.value), activity: f.elements.activity.value, goal: f.elements.goal.value });
  const show = () => { const r = calc(form); $('[data-sg-out]', form).textContent = r.ok ? `${r.target} kcal · P ${r.protein} g · C ${r.carbs} g · F ${r.fat} g (maintenance ${r.tdee})` : Object.values(r.errors)[0]; };
  form.addEventListener('input', show); show();
  void fmtDate; void ymd;
}
