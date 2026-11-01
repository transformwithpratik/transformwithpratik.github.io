import { mountPortal, loadPlans } from '../lib/portal.js';
import { supa, q, signedUrl } from '../lib/supabase.js';
import { $, html, raw, setHTML, fmtNum, fmtDate, safeUrl, youtubeEmbed } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { targetsOf } from './data.js';

const ctx = await mountPortal({ active: 'plan', title: 'My plan' });
if (ctx) render(ctx).catch((err) => setHTML(ctx.content, html`<div class="notice danger">Could not load your plan. ${err.message}</div>`));

async function render({ user, content }) {
  const [plans, exercises, foods] = await Promise.all([
    loadPlans(user.id),
    q(supa.from('exercises').select('name,slug,video_url,summary')),
    q(supa.from('foods').select('*').order('name')),
  ]);
  const { targets, workout, nutrition } = plans;
  const t = targetsOf(targets);
  const pdf = targets?.pdf_url ? await signedUrl('client-plans', targets.pdf_url) : '';
  const exByName = Object.fromEntries(exercises.map((x) => [x.name.toLowerCase(), x]));
  const nothing = !targets && !workout && !nutrition;

  setHTML(content, html`
    <div class="page-intro"><div><h2>My plan</h2><p>${targets?.updated_at || workout?.updated_at ? `Last updated ${fmtDate([targets?.updated_at, workout?.updated_at, nutrition?.updated_at].filter(Boolean).sort().at(-1))}` : 'Set by your coach'}</p></div>
      <div class="cluster no-print">${pdf ? html`<a class="btn btn-primary btn-sm" href="${pdf}" target="_blank" rel="noopener">${raw(icon('download'))} Plan PDF</a>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-print>Save as PDF</button></div></div>
    ${nothing ? html`<div class="empty"><h3>Your plan is being prepared</h3><p>Your coach will add your targets, training and meals here. You will get a notification and an email when it is ready.</p></div>` : ''}

    ${targets ? html`<section class="panel" aria-labelledby="tg">
      <div class="panel-head"><h3 id="tg">Daily targets</h3></div>
      <div class="stats" style="margin-bottom:0">
        ${t.calories ? html`<div class="stat accent"><span class="stat-label">Calories</span><span class="stat-value">${fmtNum(t.calories)}<small>kcal</small></span></div>` : ''}
        ${t.protein ? html`<div class="stat"><span class="stat-label">Protein</span><span class="stat-value">${t.protein}<small>g</small></span></div>` : ''}
        ${t.carbs ? html`<div class="stat"><span class="stat-label">Carbs</span><span class="stat-value">${t.carbs}<small>g</small></span></div>` : ''}
        ${t.fat ? html`<div class="stat"><span class="stat-label">Fat</span><span class="stat-value">${t.fat}<small>g</small></span></div>` : ''}
        ${targets.fiber_g ? html`<div class="stat"><span class="stat-label">Fibre</span><span class="stat-value">${targets.fiber_g}<small>g</small></span></div>` : ''}
        <div class="stat"><span class="stat-label">Steps</span><span class="stat-value">${fmtNum(t.steps)}</span></div>
        <div class="stat"><span class="stat-label">Water</span><span class="stat-value">${fmtNum(t.water / 1000, 1)}<small>L</small></span></div>
        <div class="stat"><span class="stat-label">Sleep</span><span class="stat-value">${t.sleep}<small>hrs</small></span></div>
      </div>
      ${targets.coach_notes ? html`<div class="notice ok" style="margin-top:16px"><span class="pre-wrap">${targets.coach_notes}</span></div>` : ''}
    </section>` : ''}

    ${workout ? html`<section class="panel" style="margin-top:16px" aria-labelledby="wp">
      <div class="panel-head"><h3 id="wp">${workout.title}</h3>${workout.starts_on ? html`<span class="small muted">From ${fmtDate(workout.starts_on)}</span>` : ''}</div>
      ${workout.notes ? html`<p class="pre-wrap muted">${workout.notes}</p>` : ''}
      ${(workout.days || []).map((d, i) => html`<details class="day" ${i === 0 ? raw('open') : ''}>
        <summary>${d.name || `Day ${i + 1}`}<span>${d.focus ? `${d.focus} · ` : ''}${(d.exercises || []).length} exercises</span></summary>
        <table class="ex-table"><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th></tr></thead>
        <tbody>${(d.exercises || []).map((x) => {
    const lib = exByName[(x.name || '').toLowerCase()];
    const video = safeUrl(x.video_url) || safeUrl(lib?.video_url);
    const embed = youtubeEmbed(video);
    return html`<tr><td><div class="ex-name">${lib ? html`<a href="/workouts#${lib.slug}" target="_blank">${x.name}</a>` : x.name}</div>
            ${x.notes ? html`<div class="ex-note pre-wrap">${x.notes}</div>` : ''}
            ${x.substitutions ? html`<div class="ex-note">Swap: ${x.substitutions}</div>` : ''}
            ${video ? html`<details style="margin-top:6px"><summary class="small" style="cursor:pointer;color:var(--lime)">Watch demo</summary>${embed ? html`<div class="video-wrap" style="margin-top:8px;max-width:420px"><iframe src="${embed}" title="${x.name} demo" loading="lazy" allowfullscreen></iframe></div>` : html`<a class="small" href="${video}" target="_blank" rel="noopener">Open video</a>`}</details>` : ''}</td>
            <td>${x.sets || '-'}</td><td>${x.reps || '-'}</td><td>${x.rest || '-'}</td></tr>`;
  })}</tbody></table></details>`)}
      <p class="no-print" style="margin-top:14px"><a class="btn btn-ghost btn-sm" href="/portal/logs/#workouts">Log today's session</a></p>
    </section>` : targets?.workout_split ? html`<section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Training</h3></div><p class="pre-wrap">${targets.workout_split}</p></section>` : ''}

    ${nutrition ? html`<section class="panel" style="margin-top:16px" aria-labelledby="np">
      <div class="panel-head"><h3 id="np">${nutrition.title}</h3></div>
      ${nutrition.restrictions ? html`<div class="notice warn" style="margin-bottom:14px"><span><b>Dietary notes:</b> ${nutrition.restrictions}</span></div>` : ''}
      ${nutrition.notes ? html`<p class="pre-wrap muted">${nutrition.notes}</p>` : ''}
      ${(nutrition.meals || []).map((m) => html`<div class="card card-flat meal-card">
        <div class="panel-head" style="margin-bottom:8px"><h4 style="margin:0;font-size:1.05rem">${m.name}${m.time ? html` <span class="muted small">· ${m.time}</span>` : ''}</h4>${m.calories || m.protein_g ? html`<span class="small muted">${m.calories ? `${fmtNum(m.calories)} kcal` : ''}${m.calories && m.protein_g ? ' · ' : ''}${m.protein_g ? `${fmtNum(m.protein_g)} g protein` : ''}</span>` : ''}</div>
        ${(m.items || []).length ? html`<ul class="ing-list" style="margin:0">${m.items.map((it) => html`<li style="border-color:var(--ink-line);display:flex;justify-content:space-between;gap:12px"><span>${it.food}</span><span class="muted">${it.quantity || ''}</span></li>`)}</ul>` : ''}
        ${m.notes ? html`<p class="small muted pre-wrap" style="margin:8px 0 0">${m.notes}</p>` : ''}
      </div>`)}
      ${(nutrition.substitutions || []).length ? html`<h4 style="margin-top:20px">Swaps</h4><div class="table-wrap"><table class="table"><thead><tr><th>Instead of</th><th>You can have</th></tr></thead><tbody>${nutrition.substitutions.map((s) => html`<tr><td>${s.swap}</td><td>${s.with}</td></tr>`)}</tbody></table></div>` : ''}
    </section>` : targets?.diet_overview ? html`<section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Nutrition</h3></div><p class="pre-wrap">${targets.diet_overview}</p></section>` : ''}

    ${targets?.supplements ? html`<section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Supplements</h3></div><p class="pre-wrap">${targets.supplements}</p><p class="small muted">Check with your doctor before starting supplements if you take medication or have a health condition.</p></section>` : ''}

    <section class="panel no-print" style="margin-top:16px" aria-labelledby="swap">
      <div class="panel-head"><h3 id="swap">Protein swap finder</h3></div>
      <p class="muted small">Out of something on your plan? Pick a food and amount to see how much of another food gives the same protein.</p>
      <div class="form-row">
        <div class="field"><label for="sw-food">Food on your plan</label><select class="input" id="sw-food" data-sw-food>${foods.filter((f) => f.protein_g >= 3).map((f) => html`<option value="${f.id}">${f.name}</option>`)}</select></div>
        <div class="field"><label for="sw-qty">Servings</label><input class="input" id="sw-qty" type="number" min="0.25" max="10" step="0.25" value="1" data-sw-qty></div>
      </div>
      <div data-sw-out></div>
    </section>`);

  $('[data-print]').addEventListener('click', () => window.print());
  const drawSwap = () => {
    const f = foods.find((x) => x.id === $('[data-sw-food]').value);
    const n = Number($('[data-sw-qty]').value) || 1;
    if (!f) return;
    const p = f.protein_g * n; const kcal = f.calories * n;
    const alts = foods.filter((x) => x.id !== f.id && x.protein_g >= 3).map((x) => {
      const servings = p / x.protein_g;
      return { x, grams: Math.round(servings * x.serving_g / 5) * 5, kcal: Math.round(servings * x.calories) };
    }).filter((a) => a.grams <= 600).sort((a, b) => a.kcal - b.kcal).slice(0, 8);
    setHTML($('[data-sw-out]'), html`<p class="small" style="margin:8px 0">${fmtNum(n, 2)} x ${f.serving_label} of ${f.name} = <b>${fmtNum(p, 1)} g protein</b>, ${fmtNum(kcal)} kcal. The same protein from:</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Food</th><th class="num">Amount</th><th class="num">Calories</th><th class="num">Difference</th></tr></thead>
      <tbody>${alts.map((a) => html`<tr><td>${a.x.name}</td><td class="num">${a.grams} ${/ml/.test(a.x.serving_label) ? 'ml' : 'g'}</td><td class="num">${fmtNum(a.kcal)}</td><td class="num">${a.kcal - kcal > 0 ? '+' : ''}${fmtNum(a.kcal - kcal)}</td></tr>`)}</tbody></table></div>
      <p class="small muted" style="margin-top:8px">Estimates from standard food values. Your coach's plan takes priority.</p>`);
  };
  $('[data-sw-food]').addEventListener('change', drawSwap);
  $('[data-sw-qty]').addEventListener('input', drawSwap);
  drawSwap();
}
