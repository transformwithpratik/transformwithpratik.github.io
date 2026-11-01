import { mountPortal } from '../lib/portal.js';
import { supa, q, uploadOwn, shrinkImage, signedUrls } from '../lib/supabase.js';
import { $, $$, html, raw, setHTML, fmtNum, fmtDate, fmtDateTime, ymd, addDays, mondayOf, numOrNull, intOrNull, toast, showErrors } from '../lib/util.js';
import { loadDays, weekdayName } from './data.js';


const SCALES = {
  sleep_quality: ['Very poor', 'Poor', 'Okay', 'Good', 'Great'],
  energy: ['Very low', 'Low', 'Okay', 'Good', 'High'],
  hunger: ['Rarely hungry', 'Mild', 'Manageable', 'Often hungry', 'Very hungry'],
  stress: ['Very low', 'Low', 'Moderate', 'High', 'Very high'],
};

async function render({ user, profile, content }) {
  const week = mondayOf();
  const [checkins, feedback, recent, days] = await Promise.all([
    q(supa.from('weekly_checkins').select('*').eq('client_id', user.id).order('week_of', { ascending: false }).limit(26)),
    q(supa.from('coach_feedback').select('*').eq('client_id', user.id).order('created_at', { ascending: false })),
    q(supa.from('progress_records').select('record_date,weight_kg').eq('client_id', user.id).not('weight_kg', 'is', null).gte('record_date', addDays(ymd(), -6)).order('record_date')),
    loadDays(user.id, addDays(ymd(), -6), ymd()),
  ]);
  const current = checkins.find((c) => c.week_of === week);
  const editable = !current || current.status === 'pending_review';
  const avgW = recent.length ? Math.round((recent.reduce((s, r) => s + Number(r.weight_kg), 0) / recent.length) * 10) / 10 : null;
  const stepDays = days.filter((d) => d.steps);
  const avgSteps = stepDays.length ? Math.round(stepDays.reduce((s, d) => s + d.steps, 0) / stepDays.length) : null;
  const sleepDays = days.filter((d) => d.sleep);
  const avgSleep = sleepDays.length ? Math.round((sleepDays.reduce((s, d) => s + Number(d.sleep), 0) / sleepDays.length) * 10) / 10 : null;
  const c = current || {};
  const photos = current ? await q(supa.from('progress_photos').select('*').eq('checkin_id', current.id)) : [];

  const scale = (name, labels) => html`<fieldset><legend>${{ sleep_quality: 'Sleep quality', energy: 'Energy', hunger: 'Hunger', stress: 'Stress' }[name]}</legend>
    <div class="scale5 choices">${labels.map((l, i) => html`<label class="choice" title="${l}"><input type="radio" name="${name}" value="${i + 1}" ${c[name] === i + 1 ? raw('checked') : ''}><span>${i + 1}</span></label>`)}</div>
    <div class="cluster small muted" style="justify-content:space-between;margin-top:4px"><span>${labels[0]}</span><span>${labels[4]}</span></div></fieldset>`;
  const slider = (name, lbl, hint) => html`<div class="field"><label for="ci-${name}">${lbl}</label>
    <div class="slider-row"><input type="range" id="ci-${name}" name="${name}" min="0" max="100" step="5" value="${c[name] ?? 80}"><output for="ci-${name}">${c[name] ?? 80}%</output></div><p class="hint">${hint}</p></div>`;

  setHTML(content, html`
    <div class="page-intro"><div><h2>Weekly check-in</h2><p>Week of ${fmtDate(week)}. Due every ${weekdayName(profile.checkin_day ?? 0)}. Takes about 5 minutes.</p></div>
      ${current ? html`<span class="tag ${current.status === 'reviewed' ? 'tag-lime' : 'tag-warn'}">${current.status === 'reviewed' ? 'Reviewed' : 'Submitted, pending review'}</span>` : ''}</div>
    <div class="panel-grid">
      <section class="panel">
        ${editable ? html`
        <form class="form" id="ciForm" novalidate>
          ${current ? html`<div class="notice">You submitted this on ${fmtDateTime(current.submitted_at)}. You can still edit it until your coach reviews it.</div>` : ''}
          <div class="form-row">
            <div class="field"><label for="ci-w">Today's weight</label><div class="input-group"><input class="input" id="ci-w" name="weight_kg" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${c.weight_kg ?? ''}"><span class="suffix">kg</span></div><p class="field-error" data-error-for="weight_kg" id="ce-w"></p></div>
            <div class="field"><label for="ci-aw">Average this week</label><div class="input-group"><input class="input" id="ci-aw" name="avg_weight_kg" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${c.avg_weight_kg ?? avgW ?? ''}"><span class="suffix">kg</span></div><p class="hint">${avgW ? `From your ${recent.length} weigh-in${recent.length > 1 ? 's' : ''} this week.` : 'Optional.'}</p></div>
          </div>
          ${slider('workout_adherence', 'Training: how much of the plan did you do?', '100% means every planned session.')}
          ${slider('nutrition_adherence', 'Nutrition: how closely did you follow your targets?', 'A rough estimate is fine.')}
          <div class="form-row">
            <div class="field"><label for="ci-sl">Average sleep</label><div class="input-group"><input class="input" id="ci-sl" name="sleep_hours" type="number" inputmode="decimal" step="0.25" min="0" max="14" value="${c.sleep_hours ?? avgSleep ?? ''}"><span class="suffix">hrs</span></div></div>
            <div class="field"><label for="ci-st">Average daily steps</label><input class="input" id="ci-st" name="steps_avg" type="number" inputmode="numeric" min="0" max="100000" value="${c.steps_avg ?? avgSteps ?? ''}"></div>
          </div>
          ${Object.entries(SCALES).map(([k, labels]) => scale(k, labels))}
          <div class="field"><label for="ci-wins">Wins this week</label><textarea class="input" id="ci-wins" name="wins" maxlength="2000" placeholder="New PR, better food choices at a party, stayed on track while travelling...">${c.wins || ''}</textarea></div>
          <div class="field"><label for="ci-ch">Challenges</label><textarea class="input" id="ci-ch" name="challenges" maxlength="2000" placeholder="Late meetings, cravings, missed sessions, soreness...">${c.challenges || ''}</textarea></div>
          <div class="field"><label for="ci-msg">Anything for your coach?</label><textarea class="input" id="ci-msg" name="coach_message" maxlength="2000" placeholder="Questions, requests to change the plan, upcoming travel">${c.coach_message || ''}</textarea></div>
          <fieldset><legend>Progress photos <span class="muted">(optional, private)</span></legend>
            ${photos.length ? html`<p class="small muted">${photos.length} photo${photos.length > 1 ? 's' : ''} attached. Adding more keeps the existing ones.</p>` : ''}
            <div class="form-row">${['front', 'side', 'back'].map((p) => html`<div class="field"><label for="ci-ph-${p}" class="small">${p[0].toUpperCase() + p.slice(1)}</label><input class="input" id="ci-ph-${p}" name="photo_${p}" type="file" accept="image/*"></div>`)}</div>
          </fieldset>
          <p class="field-error" data-error-for="form" role="alert" id="ce-form"></p>
          <button class="btn btn-primary" type="submit">${current ? 'Save changes' : 'Submit check-in'}</button>
        </form>` : html`
        <div class="notice ok">This week's check-in was reviewed. Your next one opens on Monday.</div>
        ${checkinSummary(current)}`}
      </section>
      <section class="panel">
        <div class="panel-head"><h3>Coach feedback</h3></div>
        <div data-feedback>${feedbackList(feedback.slice(0, 6), checkins)}</div>
      </section>
    </div>
    <section class="panel" style="margin-top:16px">
      <div class="panel-head"><h3>Past check-ins</h3></div>
      ${checkins.filter((x) => x.week_of !== week || !editable).length ? html`<div class="rows">${checkins.filter((x) => x.week_of !== week).map((x) => html`<details class="day"><summary>Week of ${fmtDate(x.week_of)} <span>${x.weight_kg ? `${fmtNum(x.weight_kg, 1)} kg · ` : ''}${x.status === 'reviewed' ? 'Reviewed' : 'Pending review'}</span></summary><div style="padding:14px 16px">${checkinSummary(x)}${feedbackList(feedback.filter((f) => f.checkin_id === x.id), [])}</div></details>`)}</div>`
    : html`<p class="muted small">Your previous check-ins will be listed here.</p>`}
    </section>`);

  // Mark feedback as read once shown.
  const unread = feedback.filter((f) => !f.read_at).map((f) => f.id);
  if (unread.length) supa.from('coach_feedback').update({ read_at: new Date().toISOString() }).in('id', unread).then(() => {});

  const form = $('#ciForm');
  if (!form) return;
  $$('input[type="range"]', form).forEach((r) => r.addEventListener('input', () => { r.nextElementSibling.textContent = `${r.value}%`; }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const radio = (n) => intOrNull(form.querySelector(`input[name="${n}"]:checked`)?.value);
    const row = {
      client_id: user.id, week_of: week,
      weight_kg: numOrNull(f.weight_kg.value), avg_weight_kg: numOrNull(f.avg_weight_kg.value),
      workout_adherence: intOrNull(f.workout_adherence.value), nutrition_adherence: intOrNull(f.nutrition_adherence.value),
      sleep_hours: numOrNull(f.sleep_hours.value), steps_avg: intOrNull(f.steps_avg.value),
      sleep_quality: radio('sleep_quality'), energy: radio('energy'), hunger: radio('hunger'), stress: radio('stress'),
      wins: f.wins.value.trim() || null, challenges: f.challenges.value.trim() || null, coach_message: f.coach_message.value.trim() || null,
    };
    const errs = {};
    if (row.weight_kg == null) errs.weight_kg = 'Enter today\'s weight. If you could not weigh in, use your most recent weight and mention it below.';
    else if (row.weight_kg < 30 || row.weight_kg > 300) errs.weight_kg = 'Weight must be between 30 and 300 kg.';
    if (row.sleep_hours != null && (row.sleep_hours < 0 || row.sleep_hours > 14)) errs.form = 'Sleep should be between 0 and 14 hours.';
    if (!row.energy || !row.hunger || !row.stress) errs.form = 'Rate your energy, hunger and stress (1 to 5).';
    const files = ['front', 'side', 'back'].map((p) => ({ pose: p, file: f[`photo_${p}`].files[0] })).filter((x) => x.file);
    if (files.some((x) => x.file.size > 15e6)) errs.form = 'Each photo must be under 15 MB.';
    if (!showErrors(form, errs)) return;
    const btn = form.querySelector('[type="submit"]');
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
    try {
      let id = current?.id;
      if (current) await q(supa.from('weekly_checkins').update(row).eq('id', current.id));
      else id = (await q(supa.from('weekly_checkins').insert(row).select('id').single())).id;
      for (const { pose, file } of files) {
        const path = await uploadOwn('client-photos', user.id, await shrinkImage(file), pose);
        await q(supa.from('progress_photos').insert({ client_id: user.id, taken_on: ymd(), pose, path, checkin_id: id }));
      }
      toast(current ? 'Check-in updated' : 'Check-in submitted. Your coach has been notified.');
      render({ user, profile, content });
    } catch (err) {
      showErrors(form, { form: err.message });
    } finally { btn.removeAttribute('aria-busy'); btn.disabled = false; }
  });
}

function checkinSummary(c) {
  const sc = (k) => (c[k] ? `${c[k]}/5 (${SCALES[k][c[k] - 1].toLowerCase()})` : '-');
  return html`<dl class="dl">
    <dt>Weight</dt><dd>${c.weight_kg ? `${fmtNum(c.weight_kg, 1)} kg` : '-'}${c.avg_weight_kg ? ` (week average ${fmtNum(c.avg_weight_kg, 1)} kg)` : ''}</dd>
    <dt>Training</dt><dd>${c.workout_adherence ?? '-'}%</dd>
    <dt>Nutrition</dt><dd>${c.nutrition_adherence ?? '-'}%</dd>
    <dt>Sleep</dt><dd>${c.sleep_hours ? `${fmtNum(c.sleep_hours, 1)} h, ` : ''}${sc('sleep_quality')}</dd>
    <dt>Energy</dt><dd>${sc('energy')}</dd><dt>Hunger</dt><dd>${sc('hunger')}</dd><dt>Stress</dt><dd>${sc('stress')}</dd>
    ${c.steps_avg ? html`<dt>Steps</dt><dd>${fmtNum(c.steps_avg)} a day</dd>` : ''}
    ${c.wins ? html`<dt>Wins</dt><dd class="pre-wrap">${c.wins}</dd>` : ''}
    ${c.challenges ? html`<dt>Challenges</dt><dd class="pre-wrap">${c.challenges}</dd>` : ''}
    ${c.coach_message ? html`<dt>Message</dt><dd class="pre-wrap">${c.coach_message}</dd>` : ''}
  </dl>`;
}

function feedbackList(items, checkins) {
  if (!items.length) return html`<p class="muted small">${checkins.length ? 'No feedback yet. Your coach replies after reviewing your check-in.' : ''}</p>`;
  return html`<div class="rows">${items.map((f) => html`<div class="row" style="align-items:flex-start;flex-direction:column;gap:6px">
    <span class="small muted">${fmtDateTime(f.created_at)}${f.checkin_id && checkins.length ? ` · on week of ${fmtDate(checkins.find((c) => c.id === f.checkin_id)?.week_of)}` : ''}${!f.read_at ? raw(' <span class="tag tag-lime">New</span>') : ''}</span>
    <div class="pre-wrap">${f.body}</div></div>`)}</div>`;
}
void signedUrls;

// Start last, so every module-level constant above is initialised first.
const ctx = await mountPortal({ active: 'checkins', title: 'Weekly check-in' });
if (ctx) render(ctx).catch((err) => setHTML(ctx.content, html`<div class="notice danger">Could not load check-ins. ${err.message}</div>`));
