import { mountPortal, loadPlans, openModal } from '../lib/portal.js';
import { supa, q, uploadOwn, shrinkImage, signedUrls } from '../lib/supabase.js';
import { $, $$, html, raw, setHTML, fmtNum, fmtDate, ymd, addDays, mondayOf, numOrNull, toast, confirmDialog, initTabs, downloadFile, toCSV } from '../lib/util.js';
import { lineChart } from '../lib/charts.js';
import { movingAverage } from '../lib/calc.js';
import { icon } from '../lib/icons.js';
import { loadDays, targetsOf } from './data.js';


const S = { uid: null, profile: null, records: [], photos: [], urls: {}, plans: null };
const MEAS = [['weight_kg', 'Weight', 'kg'], ['waist_cm', 'Waist', 'cm'], ['chest_cm', 'Chest', 'cm'], ['arms_cm', 'Arms', 'cm'], ['hips_cm', 'Hips', 'cm'], ['thighs_cm', 'Thighs', 'cm'], ['body_fat_pct', 'Body fat', '%']];

async function init({ user, profile, content }) {
  Object.assign(S, { uid: user.id, profile });
  setHTML(content, html`
    <div class="page-intro"><div><h2>Progress</h2><p>Your weight trend, measurements, photos and strength in one place. Photos are private to you and your coach.</p></div></div>
    <div class="tabs" role="tablist" aria-label="Progress views" data-tabs>
      <button role="tab" data-tab="body" id="t-body" aria-controls="p-body" aria-selected="true">Weight and measurements</button>
      <button role="tab" data-tab="photos" id="t-photos" aria-controls="p-photos" aria-selected="false" tabindex="-1">Photos</button>
      <button role="tab" data-tab="strength" id="t-strength" aria-controls="p-strength" aria-selected="false" tabindex="-1">Strength</button>
      <button role="tab" data-tab="reports" id="t-reports" aria-controls="p-reports" aria-selected="false" tabindex="-1">Reports</button>
    </div>
    <section id="p-body" role="tabpanel" aria-labelledby="t-body" data-body></section>
    <section id="p-photos" role="tabpanel" aria-labelledby="t-photos" hidden data-photos></section>
    <section id="p-strength" role="tabpanel" aria-labelledby="t-strength" hidden data-strength></section>
    <section id="p-reports" role="tabpanel" aria-labelledby="t-reports" hidden data-reports></section>`);
  const views = { body: renderBody, photos: renderPhotos, strength: renderStrength, reports: renderReports };
  const tabs = initTabs($('[data-tabs]'), (k) => { history.replaceState(null, '', `#${k}`); views[k]().catch((err) => toast(err.message, 'error')); });
  const h = location.hash.slice(1);
  if (views[h]) tabs.select(h); else renderBody();
}

async function loadRecords() {
  S.records = await q(supa.from('progress_records').select('*').eq('client_id', S.uid).order('record_date', { ascending: true }).order('created_at', { ascending: true }));
}

// ---------------------------------------------------------- Weight and measurements
async function renderBody() {
  const el = $('[data-body]');
  await loadRecords();
  const weights = S.records.filter((r) => r.weight_kg != null).map((r) => ({ date: r.record_date, value: Number(r.weight_kg) }));
  const first = weights[0]; const last = weights.at(-1);
  const recent = weights.filter((w) => w.date >= addDays(ymd(), -6));
  const prevWeek = weights.filter((w) => w.date >= addDays(ymd(), -13) && w.date < addDays(ymd(), -6));
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x.value, 0) / a.length : null);
  const thisAvg = avg(recent); const prevAvg = avg(prevWeek);
  const latestOf = (k) => [...S.records].reverse().find((r) => r[k] != null);
  const firstOf = (k) => S.records.find((r) => r[k] != null);

  setHTML(el, html`
    <div class="cluster" style="margin-bottom:16px"><button class="btn btn-primary btn-sm" type="button" data-add>${raw(icon('plus'))} Add weight or measurements</button></div>
    <div class="stats">
      <div class="stat"><span class="stat-label">Latest weight</span><span class="stat-value">${last ? fmtNum(last.value, 1) : '-'}<small>kg</small></span><span class="stat-sub">${last ? fmtDate(last.date) : 'No weigh-ins yet'}</span></div>
      <div class="stat"><span class="stat-label">7-day average</span><span class="stat-value">${thisAvg ? fmtNum(thisAvg, 1) : '-'}<small>kg</small></span><span class="stat-sub">${thisAvg && prevAvg ? `${thisAvg - prevAvg > 0 ? '+' : ''}${fmtNum(thisAvg - prevAvg, 2)} kg vs previous week` : 'Weigh in 3+ times a week'}</span></div>
      <div class="stat"><span class="stat-label">Total change</span><span class="stat-value">${first && last ? `${last.value - first.value > 0 ? '+' : ''}${fmtNum(last.value - first.value, 1)}` : '-'}<small>kg</small></span><span class="stat-sub">${first ? `Since ${fmtDate(first.date)}` : ''}</span></div>
      <div class="stat"><span class="stat-label">Waist change</span><span class="stat-value">${firstOf('waist_cm') && latestOf('waist_cm') ? `${latestOf('waist_cm').waist_cm - firstOf('waist_cm').waist_cm > 0 ? '+' : ''}${fmtNum(latestOf('waist_cm').waist_cm - firstOf('waist_cm').waist_cm, 1)}` : '-'}<small>cm</small></span><span class="stat-sub">${latestOf('waist_cm') ? `Now ${fmtNum(latestOf('waist_cm').waist_cm, 1)} cm` : 'Measure every 2 weeks'}</span></div>
    </div>
    <div class="panel-grid">
      <section class="panel"><div class="panel-head"><h3>Weight trend</h3>
        <div class="segmented" role="group" aria-label="Range"><button type="button" data-r="30" aria-pressed="false">1 month</button><button type="button" data-r="90" aria-pressed="true">3 months</button><button type="button" data-r="3650" aria-pressed="false">All</button></div></div>
        <div data-wchart></div></section>
      <section class="panel"><div class="panel-head"><h3>Measurements</h3>
        <select class="input" data-mpick style="min-height:38px;width:auto" aria-label="Measurement">${MEAS.slice(1).map(([k, n]) => html`<option value="${k}">${n}</option>`)}</select></div>
        <div data-mchart></div></section>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>History</h3>
      <button class="btn btn-quiet btn-sm" type="button" data-csv>${raw(icon('download'))} Download CSV</button></div>
      ${S.records.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Date</th>${MEAS.map(([, n, u]) => html`<th class="num">${n} (${u})</th>`)}<th>Notes</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${[...S.records].reverse().map((r) => html`<tr><td>${fmtDate(r.record_date)}${r.source === 'checkin' ? raw(' <span class="tag">check-in</span>') : ''}</td>${MEAS.map(([k]) => html`<td class="num">${r[k] != null ? fmtNum(r[k], 1) : '-'}</td>`)}<td>${r.notes || ''}</td>
          <td><div class="actions" style="display:flex"><button class="icon-btn" type="button" data-edit="${r.id}"><span class="sr-only">Edit ${fmtDate(r.record_date)}</span>${raw(icon('edit'))}</button><button class="icon-btn" type="button" data-del="${r.id}"><span class="sr-only">Delete ${fmtDate(r.record_date)}</span>${raw(icon('trash'))}</button></div></td></tr>`)}</tbody></table></div>`
    : html`<div class="empty"><h3>No measurements yet</h3><p>Weigh yourself first thing in the morning, after the toilet and before eating, 3 or more times a week. Measure your waist every 2 weeks.</p></div>`}
    </section>`);

  const drawW = (days) => {
    const from = addDays(ymd(), -days);
    const pts = weights.filter((w) => w.date >= from);
    lineChart($('[data-wchart]'), [
      { name: 'Weigh-ins', points: pts.map((p) => ({ x: p.date, y: p.value })) },
      { name: '7-day average', points: movingAverage(weights).filter((p) => p.date >= from).map((p) => ({ x: p.date, y: p.value })), dots: false },
    ], { unit: ' kg', goal: S.profile.target_weight, label: 'Weight trend', emptyText: 'Add your first weigh-in to start your trend.' });
  };
  drawW(90);
  $$('[data-r]').forEach((b) => b.addEventListener('click', () => { $$('[data-r]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); drawW(Number(b.dataset.r)); }));
  const drawM = (k) => {
    const [, n, u] = MEAS.find((m) => m[0] === k);
    lineChart($('[data-mchart]'), [{ name: n, points: S.records.filter((r) => r[k] != null).map((r) => ({ x: r.record_date, y: Number(r[k]) })) }], { unit: ` ${u}`, label: `${n} over time`, emptyText: `No ${n.toLowerCase()} measurements yet.` });
  };
  drawM('waist_cm');
  $('[data-mpick]').addEventListener('change', (e) => drawM(e.target.value));
  $('[data-add]').addEventListener('click', () => recordModal({}));
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => recordModal(S.records.find((r) => r.id === b.dataset.edit))));
  $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const r = S.records.find((x) => x.id === b.dataset.del);
    if (!(await confirmDialog({ title: 'Delete this entry?', body: `Measurements from ${fmtDate(r.record_date)} will be removed.` }))) return;
    try { await q(supa.from('progress_records').delete().eq('id', r.id)); toast('Deleted'); renderBody(); } catch (err) { toast(err.message, 'error'); }
  }));
  $('[data-csv]').addEventListener('click', () => downloadFile(`progress-${ymd()}.csv`, toCSV(S.records.map((r) => Object.fromEntries([['date', r.record_date], ...MEAS.map(([k]) => [k, r[k]]), ['notes', r.notes]]))), 'text/csv'));
}

function recordModal(r) {
  const isEdit = !!r.id;
  const ranges = { weight_kg: [30, 300], waist_cm: [30, 250], chest_cm: [30, 250], arms_cm: [10, 100], hips_cm: [30, 250], thighs_cm: [20, 150], body_fat_pct: [2, 70] };
  openModal({
    title: isEdit ? 'Edit measurements' : 'Add weight or measurements',
    body: html`
      <div class="field"><label for="m-date">Date</label><input class="input" id="m-date" name="record_date" type="date" max="${ymd()}" value="${r.record_date || ymd()}"></div>
      <div class="form-row">${MEAS.map(([k, n, u]) => html`<div class="field"><label for="m-${k}">${n}</label><div class="input-group"><input class="input" id="m-${k}" name="${k}" type="number" inputmode="decimal" step="0.1" min="${ranges[k][0]}" max="${ranges[k][1]}" value="${r[k] ?? ''}"><span class="suffix">${u}</span></div></div>`)}</div>
      <div class="field"><label for="m-notes">Notes</label><input class="input" id="m-notes" name="notes" maxlength="1000" value="${r.notes || ''}"></div>
      <p class="hint">Fill in only what you measured today. Measure arms and thighs at the widest point, on the same side each time.</p>`,
    submit: isEdit ? 'Save changes' : 'Save',
    onSubmit: async (f) => {
      const e = f.elements;
      const row = { client_id: S.uid, record_date: e.record_date.value, notes: e.notes.value.trim() || null };
      for (const [k, n] of MEAS) {
        row[k] = numOrNull(e[k].value);
        if (row[k] != null && (row[k] < ranges[k][0] || row[k] > ranges[k][1])) throw new Error(`${n} should be between ${ranges[k][0]} and ${ranges[k][1]}.`);
      }
      if (!row.record_date || row.record_date > ymd()) throw new Error('Choose a date up to today.');
      if (MEAS.every(([k]) => row[k] == null)) throw new Error('Enter at least one measurement.');
      if (isEdit) await q(supa.from('progress_records').update(row).eq('id', r.id));
      else await q(supa.from('progress_records').insert(row));
      toast('Saved');
      renderBody();
    },
  });
}

// ------------------------------------------------------------------ Photos
async function renderPhotos() {
  const el = $('[data-photos]');
  setHTML(el, html`<div class="skeleton" style="height:240px"></div>`);
  S.photos = await q(supa.from('progress_photos').select('*').eq('client_id', S.uid).order('taken_on', { ascending: false }));
  S.urls = await signedUrls('client-photos', S.photos.map((p) => p.path));
  const dates = [...new Set(S.photos.map((p) => p.taken_on))];
  setHTML(el, html`
    <div class="panel-grid">
      <section class="panel">
        <div class="panel-head"><h3>Add photos</h3></div>
        <form class="form" data-upload>
          <div class="form-row">
            <div class="field"><label for="ph-date">Date</label><input class="input" id="ph-date" name="taken_on" type="date" max="${ymd()}" value="${ymd()}"></div>
            <div class="field"><label for="ph-pose">Pose</label><select class="input" id="ph-pose" name="pose"><option value="front">Front</option><option value="side">Side</option><option value="back">Back</option><option value="other">Other</option></select></div>
          </div>
          <label class="upload"><input type="file" name="file" accept="image/*" multiple>${raw(icon('photo'))}<span data-file-label>Choose photos (JPG, PNG or HEIC, up to 15 MB each)</span></label>
          <button class="btn btn-primary btn-sm" type="submit">Upload</button>
          <p class="hint">Same spot, same light, same time of day, fitted clothing. Photos are stored privately and shown only to you and your coach.</p>
        </form>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>Before and after</h3></div>
        ${dates.length >= 2 ? html`<div class="form-row" style="margin-bottom:12px">
            <div class="field"><label for="c-a">Before</label><select class="input" id="c-a" data-ca>${dates.map((d, i) => html`<option value="${d}" ${i === dates.length - 1 ? raw('selected') : ''}>${fmtDate(d)}</option>`)}</select></div>
            <div class="field"><label for="c-b">After</label><select class="input" id="c-b" data-cb>${dates.map((d) => html`<option value="${d}">${fmtDate(d)}</option>`)}</select></div>
            <div class="field"><label for="c-p">Pose</label><select class="input" id="c-p" data-cp><option value="front">Front</option><option value="side">Side</option><option value="back">Back</option><option value="other">Other</option></select></div>
          </div><div class="compare" data-compare></div>`
    : html`<div class="empty"><h3>Two dates needed</h3><p>Upload photos on two different dates to compare them side by side.</p></div>`}
      </section>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Timeline</h3><span class="small muted">${S.photos.length} photos</span></div>
      ${dates.length ? dates.map((d) => html`<h4 style="font-size:1rem;margin:18px 0 10px">${fmtDate(d, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</h4>
        <div class="photo-grid">${S.photos.filter((p) => p.taken_on === d).map((p) => html`<figure class="photo">${S.urls[p.path] ? html`<img src="${S.urls[p.path]}" alt="${p.pose} photo, ${fmtDate(d)}" loading="lazy">` : ''}
          <figcaption><span>${p.pose}</span>${p.checkin_id ? raw('<span>check-in</span>') : ''}</figcaption>
          <button class="icon-btn" type="button" data-del-photo="${p.id}"><span class="sr-only">Delete photo</span>${raw(icon('trash'))}</button></figure>`)}</div>`)
    : html`<div class="empty"><h3>No photos yet</h3><p>Photos often show progress the scale misses. Take front, side and back photos every 2 to 4 weeks.</p></div>`}
    </section>`);

  const form = $('[data-upload]');
  form.elements.file.addEventListener('change', () => { $('[data-file-label]').textContent = form.elements.file.files.length ? `${form.elements.file.files.length} photo(s) selected` : 'Choose photos'; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const files = [...form.elements.file.files];
    if (!files.length) { toast('Choose at least one photo.', 'error'); return; }
    if (files.some((f) => f.size > 15e6)) { toast('Each photo must be under 15 MB.', 'error'); return; }
    const btn = form.querySelector('[type="submit"]');
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
    try {
      for (const f of files) {
        const path = await uploadOwn('client-photos', S.uid, await shrinkImage(f), form.elements.pose.value);
        await q(supa.from('progress_photos').insert({ client_id: S.uid, taken_on: form.elements.taken_on.value, pose: form.elements.pose.value, path }));
      }
      toast(`Uploaded ${files.length} photo${files.length > 1 ? 's' : ''}`);
      renderPhotos();
    } catch (err) { toast(`Upload failed: ${err.message}`, 'error'); } finally { btn.removeAttribute('aria-busy'); btn.disabled = false; }
  });
  $$('[data-del-photo]').forEach((b) => b.addEventListener('click', async () => {
    const p = S.photos.find((x) => x.id === b.dataset.delPhoto);
    if (!(await confirmDialog({ title: 'Delete this photo?', body: 'The photo is permanently removed for you and your coach.' }))) return;
    try {
      await q(supa.from('progress_photos').delete().eq('id', p.id));
      await supa.storage.from('client-photos').remove([p.path]);
      toast('Photo deleted'); renderPhotos();
    } catch (err) { toast(err.message, 'error'); }
  }));
  const drawCompare = () => {
    const box = $('[data-compare]'); if (!box) return;
    const pose = $('[data-cp]').value;
    const pick = (d) => S.photos.find((p) => p.taken_on === d && p.pose === pose) || S.photos.find((p) => p.taken_on === d);
    const a = pick($('[data-ca]').value); const b = pick($('[data-cb]').value);
    setHTML(box, [a, b].map((p, i) => html`<figure class="photo">${p && S.urls[p.path] ? html`<img src="${S.urls[p.path]}" alt="${i ? 'After' : 'Before'}">` : ''}<figcaption><span>${i ? 'After' : 'Before'}</span><span>${p ? fmtDate(p.taken_on, { day: 'numeric', month: 'short' }) : 'No photo'}</span></figcaption></figure>`));
  };
  ['[data-ca]', '[data-cb]', '[data-cp]'].forEach((s) => $(s)?.addEventListener('change', drawCompare));
  drawCompare();
}

// ---------------------------------------------------------------- Strength
async function renderStrength() {
  const el = $('[data-strength]');
  const all = await q(supa.from('workout_logs').select('exercise,log_date,weight_kg,reps,sets,est_1rm').eq('client_id', S.uid).order('log_date').limit(5000));
  const byEx = {};
  for (const r of all) (byEx[r.exercise.trim().toLowerCase()] ||= { name: r.exercise, rows: [] }).rows.push(r);
  const list = Object.values(byEx).filter((x) => x.rows.some((r) => r.weight_kg != null)).sort((a, b) => b.rows.length - a.rows.length);
  if (!list.length) { setHTML(el, html`<div class="empty"><h3>No strength data yet</h3><p>Log exercises with weight and reps in <a href="/portal/logs/#workouts">Food and workouts</a> to see your progression.</p></div>`); return; }
  setHTML(el, html`
    <section class="panel"><div class="panel-head"><h3>Strength progression</h3>
      <select class="input" data-ex style="min-height:38px;width:auto" aria-label="Exercise">${list.map((x, i) => html`<option value="${i}">${x.name} (${x.rows.length})</option>`)}</select></div>
      <div data-schart></div>
      <p class="small muted" style="margin:8px 0 0">Best estimated one-rep max per session (Epley formula) and heaviest weight lifted.</p></section>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Records by exercise</h3></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Exercise</th><th class="num">Sessions</th><th class="num">Heaviest</th><th class="num">Best est. 1RM</th><th>Last done</th></tr></thead>
      <tbody>${list.map((x) => {
    const heavy = Math.max(...x.rows.map((r) => Number(r.weight_kg) || 0));
    const e1 = Math.max(...x.rows.map((r) => Number(r.est_1rm) || 0));
    return html`<tr><td>${x.name}</td><td class="num">${new Set(x.rows.map((r) => r.log_date)).size}</td><td class="num">${heavy ? `${fmtNum(heavy, 1)} kg` : '-'}</td><td class="num">${e1 ? `${fmtNum(e1, 1)} kg` : '-'}</td><td>${fmtDate(x.rows.at(-1).log_date)}</td></tr>`;
  })}</tbody></table></div></section>`);
  const draw = (i) => {
    const rows = list[i].rows;
    const byDate = {};
    for (const r of rows) {
      const d = byDate[r.log_date] ||= { e1: null, w: null };
      if (r.est_1rm != null) d.e1 = Math.max(d.e1 || 0, Number(r.est_1rm));
      if (r.weight_kg != null) d.w = Math.max(d.w || 0, Number(r.weight_kg));
    }
    const dates = Object.keys(byDate).sort();
    lineChart($('[data-schart]'), [
      { name: 'Est. 1RM', points: dates.map((d) => ({ x: d, y: byDate[d].e1 })) },
      { name: 'Heaviest set', points: dates.map((d) => ({ x: d, y: byDate[d].w })) },
    ], { unit: ' kg', label: `${list[i].name} progression` });
  };
  draw(0);
  $('[data-ex]').addEventListener('change', (e) => draw(Number(e.target.value)));
}

// ----------------------------------------------------------------- Reports
async function renderReports() {
  const el = $('[data-reports]');
  setHTML(el, html`<div class="skeleton" style="height:240px"></div>`);
  if (!S.records.length) await loadRecords();
  S.plans ||= await loadPlans(S.uid);
  const t = targetsOf(S.plans.targets);
  const from = addDays(mondayOf(), -7 * 11);
  const [days, checkins] = await Promise.all([
    loadDays(S.uid, from, ymd()),
    q(supa.from('weekly_checkins').select('week_of,status,workout_adherence,nutrition_adherence').eq('client_id', S.uid).gte('week_of', from)),
  ]);
  const weeks = [];
  for (let w = mondayOf(); w >= from; w = addDays(w, -7)) {
    const end = addDays(w, 6);
    const ds = days.filter((d) => d.date >= w && d.date <= end);
    const ws = S.records.filter((r) => r.weight_kg != null && r.record_date >= w && r.record_date <= end).map((r) => Number(r.weight_kg));
    const cal = ds.filter((d) => d.calories); const pro = ds.filter((d) => d.protein);
    weeks.push({
      week: w, avgWeight: ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null,
      avgCal: cal.length ? cal.reduce((a, d) => a + d.calories, 0) / cal.length : null,
      avgPro: pro.length ? pro.reduce((a, d) => a + d.protein, 0) / pro.length : null,
      workouts: ds.filter((d) => d.workout).length, logged: ds.filter((d) => d.logged).length,
      checkin: checkins.find((c) => c.week_of === w),
    });
  }
  weeks.forEach((w, i) => { const prev = weeks[i + 1]; w.change = w.avgWeight != null && prev?.avgWeight != null ? w.avgWeight - prev.avgWeight : null; });
  const months = [...new Set([...S.records.map((r) => r.record_date.slice(0, 7)), ymd().slice(0, 7)])].sort().reverse();

  setHTML(el, html`
    <section class="panel"><div class="panel-head"><h3>Weekly summary</h3><span class="small muted">Last 12 weeks</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Week of</th><th class="num">Avg weight</th><th class="num">Change</th><th class="num">Avg kcal</th><th class="num">Avg protein</th><th class="num">Workouts</th><th class="num">Days logged</th><th>Check-in</th></tr></thead>
      <tbody>${weeks.map((w) => html`<tr><td>${fmtDate(w.week, { day: 'numeric', month: 'short' })}</td>
        <td class="num">${w.avgWeight != null ? fmtNum(w.avgWeight, 1) : '-'}</td>
        <td class="num">${w.change != null ? `${w.change > 0 ? '+' : ''}${fmtNum(w.change, 2)}` : '-'}</td>
        <td class="num">${w.avgCal != null ? fmtNum(w.avgCal) : '-'}</td>
        <td class="num">${w.avgPro != null ? `${fmtNum(w.avgPro)} g` : '-'}</td>
        <td class="num">${w.workouts}</td><td class="num">${w.logged}/7</td>
        <td>${w.checkin ? (w.checkin.status === 'reviewed' ? 'Reviewed' : 'Submitted') : '-'}</td></tr>`)}</tbody></table></div></section>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Monthly report</h3>
      <div class="cluster"><select class="input" data-month style="min-height:38px;width:auto" aria-label="Month">${months.map((m) => html`<option value="${m}">${new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>`)}</select>
      <button class="btn btn-ghost btn-sm" type="button" data-print>${raw(icon('download'))} Save as PDF</button></div></div>
      <div data-month-out></div></section>`);
  const drawMonth = async (m) => {
    const start = `${m}-01`;
    const endD = new Date(`${m}-01T00:00:00`); endD.setMonth(endD.getMonth() + 1); endD.setDate(0);
    const end = ymd(endD) > ymd() ? ymd() : ymd(endD);
    const md = await loadDays(S.uid, start, end);
    const recs = S.records.filter((r) => r.record_date >= start && r.record_date <= end);
    const firstW = recs.find((r) => r.weight_kg != null); const lastW = [...recs].reverse().find((r) => r.weight_kg != null);
    const firstWaist = recs.find((r) => r.waist_cm != null); const lastWaist = [...recs].reverse().find((r) => r.waist_cm != null);
    const cal = md.filter((d) => d.calories); const pro = md.filter((d) => d.protein);
    const ci = await q(supa.from('weekly_checkins').select('*').eq('client_id', S.uid).gte('week_of', addDays(start, -6)).lte('week_of', end));
    const avgOf = (arr, k) => (arr.length ? arr.reduce((s, x) => s + (Number(x[k]) || 0), 0) / arr.length : null);
    setHTML($('[data-month-out]'), html`
      <div class="print-only"><h2>${S.profile.full_name || ''}: progress report, ${new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2></div>
      <div class="stats">
        <div class="stat"><span class="stat-label">Weight</span><span class="stat-value">${lastW ? fmtNum(lastW.weight_kg, 1) : '-'}<small>kg</small></span><span class="stat-sub">${firstW && lastW && firstW !== lastW ? `${lastW.weight_kg - firstW.weight_kg > 0 ? '+' : ''}${fmtNum(lastW.weight_kg - firstW.weight_kg, 1)} kg this month` : 'One weigh-in or fewer'}</span></div>
        <div class="stat"><span class="stat-label">Waist</span><span class="stat-value">${lastWaist ? fmtNum(lastWaist.waist_cm, 1) : '-'}<small>cm</small></span><span class="stat-sub">${firstWaist && lastWaist && firstWaist !== lastWaist ? `${lastWaist.waist_cm - firstWaist.waist_cm > 0 ? '+' : ''}${fmtNum(lastWaist.waist_cm - firstWaist.waist_cm, 1)} cm` : ''}</span></div>
        <div class="stat"><span class="stat-label">Average calories</span><span class="stat-value">${cal.length ? fmtNum(avgOf(cal, 'calories')) : '-'}</span><span class="stat-sub">${t.calories ? `Target ${fmtNum(t.calories)}` : ''} · ${cal.length} days logged</span></div>
        <div class="stat"><span class="stat-label">Average protein</span><span class="stat-value">${pro.length ? fmtNum(avgOf(pro, 'protein')) : '-'}<small>g</small></span><span class="stat-sub">${t.protein ? `Target ${t.protein} g` : ''}</span></div>
        <div class="stat"><span class="stat-label">Workouts</span><span class="stat-value">${md.filter((d) => d.workout).length}</span><span class="stat-sub">${md.length} days in period</span></div>
        <div class="stat"><span class="stat-label">Check-ins</span><span class="stat-value">${ci.length}</span><span class="stat-sub">${ci.length ? `Avg adherence: training ${fmtNum(avgOf(ci, 'workout_adherence'))}%, food ${fmtNum(avgOf(ci, 'nutrition_adherence'))}%` : ''}</span></div>
      </div>
      <div data-month-chart></div>`);
    lineChart($('[data-month-chart]'), [{ name: 'Weight', points: recs.filter((r) => r.weight_kg != null).map((r) => ({ x: r.record_date, y: Number(r.weight_kg) })) }], { unit: ' kg', label: 'Weight this month', emptyText: 'No weigh-ins this month.' });
  };
  drawMonth(months[0]);
  $('[data-month]').addEventListener('change', (e) => drawMonth(e.target.value));
  $('[data-print]').addEventListener('click', () => window.print());
}

// Start last, so every module-level constant above is initialised first.
const ctx = await mountPortal({ active: 'progress', title: 'Progress' });
if (ctx) init(ctx).catch((err) => setHTML(ctx.content, html`<div class="notice danger">Could not load your progress. ${err.message}</div>`));
