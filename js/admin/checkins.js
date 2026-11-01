import { route, refreshCounts, q, supa } from './shell.js';
import { $, $$, html, raw, setHTML, fmtNum, fmtDate, fmtDateTime, toast, busy, intOrNull, addDays } from '../lib/util.js';
import { signedUrls } from '../lib/supabase.js';

route('checkins', async (view, which = 'pending') => {
  const query = supa.from('weekly_checkins').select('*, profiles!weekly_checkins_client_id_fkey(full_name,email)').order('submitted_at', { ascending: which === 'pending' }).limit(60);
  const rows = await q(which === 'pending' ? query.eq('status', 'pending_review') : query.eq('status', 'reviewed'));
  setHTML(view, html`
    <div class="page-intro"><div><h2>Check-ins</h2><p>${which === 'pending' ? `${rows.length} waiting for your feedback, oldest first.` : 'Recently reviewed.'}</p></div>
      <div class="segmented" role="group" aria-label="Filter"><a class="btn btn-sm ${which === 'pending' ? 'btn-primary' : 'btn-quiet'}" href="#checkins/pending">To review</a><a class="btn btn-sm ${which === 'reviewed' ? 'btn-primary' : 'btn-quiet'}" href="#checkins/reviewed">Reviewed</a></div></div>
    <div class="stack" style="--stack:16px" data-cards></div>`);
  const box = $('[data-cards]');
  if (!rows.length) { setHTML(box, html`<div class="empty"><h3>${which === 'pending' ? 'All caught up' : 'Nothing reviewed yet'}</h3><p>${which === 'pending' ? 'New check-ins appear here and you get an email for each one.' : ''}</p></div>`); return; }
  for (const r of rows) box.appendChild(await checkinCard(r, { showName: true, onDone: () => { refreshCounts(); location.hash === '#checkins' || location.hash === '#checkins/pending' ? window.dispatchEvent(new HashChangeEvent('hashchange')) : null; } }));
});

const SC = { energy: ['Very low', 'Low', 'Okay', 'Good', 'High'], hunger: ['Rarely', 'Mild', 'Manageable', 'Often', 'Very'], stress: ['Very low', 'Low', 'Moderate', 'High', 'Very high'], sleep_quality: ['Very poor', 'Poor', 'Okay', 'Good', 'Great'] };

export async function checkinCard(c, { showName = true, onDone } = {}) {
  const [feedback, photos, plan, prev, logs] = await Promise.all([
    q(supa.from('coach_feedback').select('*').eq('checkin_id', c.id).order('created_at')),
    q(supa.from('progress_photos').select('*').eq('checkin_id', c.id)),
    q(supa.from('plans').select('id,daily_calories,protein_g,carbs_g,fat_g,steps_target').eq('client_id', c.client_id).eq('is_active', true).maybeSingle()),
    q(supa.from('weekly_checkins').select('weight_kg,avg_weight_kg,week_of').eq('client_id', c.client_id).lt('week_of', c.week_of).order('week_of', { ascending: false }).limit(1).maybeSingle()),
    q(supa.from('food_logs').select('log_date,calories,protein_g').eq('client_id', c.client_id).gte('log_date', c.week_of).lte('log_date', addDays(c.week_of, 6))),
  ]);
  const urls = await signedUrls('client-photos', photos.map((p) => p.path));
  const days = {}; logs.forEach((l) => { const d = days[l.log_date] ||= { k: 0, p: 0 }; d.k += Number(l.calories) || 0; d.p += Number(l.protein_g) || 0; });
  const dv = Object.values(days);
  const avgK = dv.length ? dv.reduce((s, d) => s + d.k, 0) / dv.length : null;
  const avgP = dv.length ? dv.reduce((s, d) => s + d.p, 0) / dv.length : null;
  const wNow = c.avg_weight_kg ?? c.weight_kg; const wPrev = prev ? (prev.avg_weight_kg ?? prev.weight_kg) : null;
  const delta = wNow != null && wPrev != null ? wNow - wPrev : null;
  const sc = (k) => (c[k] ? `${c[k]}/5 ${SC[k][c[k] - 1].toLowerCase()}` : '-');
  const el = document.createElement('section');
  el.className = 'panel';
  el.innerHTML = String(html`
    <div class="panel-head"><h3>${showName ? html`<a href="#client/${c.client_id}/checkins">${c.profiles?.full_name || c.profiles?.email || 'Client'}</a> · ` : ''}Week of ${fmtDate(c.week_of)}</h3>
      <span class="small muted">${fmtDateTime(c.submitted_at)} · ${c.status === 'reviewed' ? 'Reviewed' : 'Pending review'}</span></div>
    <div class="stats" style="margin-bottom:14px">
      <div class="stat"><span class="stat-label">Weight</span><span class="stat-value">${c.weight_kg ? fmtNum(c.weight_kg, 1) : '-'}<small>kg</small></span><span class="stat-sub">${c.avg_weight_kg ? `avg ${fmtNum(c.avg_weight_kg, 1)}` : ''}${delta != null ? ` · ${delta > 0 ? '+' : ''}${fmtNum(delta, 2)} vs last week` : ''}</span></div>
      <div class="stat"><span class="stat-label">Adherence</span><span class="stat-value" style="font-size:1.3rem">${c.workout_adherence ?? '-'}% / ${c.nutrition_adherence ?? '-'}%</span><span class="stat-sub">Training / nutrition</span></div>
      <div class="stat"><span class="stat-label">Food logged</span><span class="stat-value" style="font-size:1.3rem">${avgK != null ? fmtNum(avgK) : '-'}<small>kcal</small></span><span class="stat-sub">${avgP != null ? `${fmtNum(avgP)} g protein · ${dv.length} days` : 'No food logs this week'}${plan?.daily_calories ? ` · target ${fmtNum(plan.daily_calories)}` : ''}</span></div>
      <div class="stat"><span class="stat-label">Sleep and steps</span><span class="stat-value" style="font-size:1.3rem">${c.sleep_hours ? `${fmtNum(c.sleep_hours, 1)} h` : '-'}</span><span class="stat-sub">${c.steps_avg ? `${fmtNum(c.steps_avg)} steps/day` : ''}</span></div>
    </div>
    <dl class="dl"><dt>Energy</dt><dd>${sc('energy')}</dd><dt>Hunger</dt><dd>${sc('hunger')}</dd><dt>Stress</dt><dd>${sc('stress')}</dd><dt>Sleep quality</dt><dd>${sc('sleep_quality')}</dd>
      ${c.wins ? html`<dt>Wins</dt><dd class="pre-wrap">${c.wins}</dd>` : ''}${c.challenges ? html`<dt>Challenges</dt><dd class="pre-wrap">${c.challenges}</dd>` : ''}${c.coach_message ? html`<dt>Message to you</dt><dd class="pre-wrap"><b>${c.coach_message}</b></dd>` : ''}</dl>
    ${photos.length ? html`<div class="photo-grid" style="margin-top:14px">${photos.map((p) => html`<figure class="photo">${urls[p.path] ? html`<a href="${urls[p.path]}" target="_blank" rel="noopener"><img src="${urls[p.path]}" alt="${p.pose}" loading="lazy"></a>` : ''}<figcaption><span>${p.pose}</span></figcaption></figure>`)}</div>` : ''}
    ${feedback.length ? html`<h4 style="font-size:1rem;margin:18px 0 8px">Your feedback</h4><div class="rows">${feedback.map((f) => html`<div class="row" style="flex-direction:column;align-items:flex-start;gap:4px"><span class="small muted">${fmtDateTime(f.created_at)}${f.read_at ? ' · read' : ' · not read yet'}</span><div class="pre-wrap">${f.body}</div></div>`)}</div>` : ''}
    <form class="form" data-fb style="margin-top:16px">
      <div class="field"><label for="fb-${c.id}">Feedback for ${showName ? (c.profiles?.full_name || 'the client').split(' ')[0] : 'the client'}</label><textarea class="input" id="fb-${c.id}" name="body" maxlength="5000" placeholder="What went well, what to focus on next week, any changes to the plan"></textarea></div>
      <details><summary class="small" style="cursor:pointer;color:var(--lime)">Adjust targets</summary>
        <div class="form-row" style="margin-top:10px">
          <div class="field"><label for="t-daily_calories-${c.id}">Calories</label><input class="input" id="t-daily_calories-${c.id}" name="daily_calories" type="number" min="800" max="6000" value="${plan?.daily_calories ?? ''}"></div>
          <div class="field"><label for="t-protein_g-${c.id}">Protein (g)</label><input class="input" id="t-protein_g-${c.id}" name="protein_g" type="number" min="0" max="400" value="${plan?.protein_g ?? ''}"></div>
          <div class="field"><label for="t-carbs_g-${c.id}">Carbs (g)</label><input class="input" id="t-carbs_g-${c.id}" name="carbs_g" type="number" min="0" max="900" value="${plan?.carbs_g ?? ''}"></div>
          <div class="field"><label for="t-fat_g-${c.id}">Fat (g)</label><input class="input" id="t-fat_g-${c.id}" name="fat_g" type="number" min="0" max="300" value="${plan?.fat_g ?? ''}"></div>
          <div class="field"><label for="t-steps_target-${c.id}">Steps</label><input class="input" id="t-steps_target-${c.id}" name="steps_target" type="number" min="0" max="50000" value="${plan?.steps_target ?? ''}"></div>
        </div></details>
      <div class="cluster"><button class="btn btn-primary btn-sm" type="submit">Send feedback</button>${c.status !== 'reviewed' ? html`<button class="btn btn-quiet btn-sm" type="button" data-mark>Mark reviewed without feedback</button>` : ''}</div>
    </form>`);
  const form = el.querySelector('[data-fb]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form.elements;
    const body = f.body.value.trim();
    const t = { daily_calories: intOrNull(f.daily_calories.value), protein_g: intOrNull(f.protein_g.value), carbs_g: intOrNull(f.carbs_g.value), fat_g: intOrNull(f.fat_g.value), steps_target: intOrNull(f.steps_target.value) };
    const changed = Object.entries(t).filter(([k, v]) => v !== (plan?.[k] ?? null));
    if (!body && !changed.length) { toast('Write some feedback or change a target.', 'error'); return; }
    busy(form.querySelector('[type="submit"]'), async () => {
      try {
        if (changed.length) {
          if (plan) await q(supa.from('plans').update(Object.fromEntries(changed)).eq('id', plan.id));
          else await q(supa.from('plans').insert({ client_id: c.client_id, ...t }));
        }
        const text = body + (changed.length ? `${body ? '\n\n' : ''}Updated targets: ${changed.map(([k, v]) => `${{ daily_calories: 'calories', protein_g: 'protein (g)', carbs_g: 'carbs (g)', fat_g: 'fat (g)', steps_target: 'steps' }[k]} ${v ?? 'cleared'}`).join(', ')}.` : '');
        await q(supa.from('coach_feedback').insert({ client_id: c.client_id, checkin_id: c.id, body: text }));
        toast('Feedback sent. The client has been notified.');
        const fresh = await checkinCard({ ...c, status: 'reviewed' }, { showName, onDone });
        el.replaceWith(fresh); onDone?.();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
  el.querySelector('[data-mark]')?.addEventListener('click', async (e) => busy(e.currentTarget, async () => {
    try { await q(supa.from('weekly_checkins').update({ status: 'reviewed' }).eq('id', c.id)); toast('Marked reviewed'); el.replaceWith(await checkinCard({ ...c, status: 'reviewed' }, { showName, onDone })); onDone?.(); } catch (err) { toast(err.message, 'error'); }
  }));
  void $; void $$; void raw; void setHTML;
  return el;
}
