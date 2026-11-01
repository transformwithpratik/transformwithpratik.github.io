import { mountPortal, loadPlans } from '../lib/portal.js';
import { supa, q } from '../lib/supabase.js';
import { $, $$, html, raw, setHTML, fmtNum, fmtDate, ymd, addDays, mondayOf, parseYmd, label, timeAgo, safeUrl } from '../lib/util.js';
import { lineChart, barChart } from '../lib/charts.js';
import { movingAverage } from '../lib/calc.js';
import { loadDays, targetsOf, habitsMet, streak, nextCheckin, weekdayName } from './data.js';
import { openQuickLog } from './quicklog.js';

const ctx = await mountPortal({ active: 'dashboard', title: 'Dashboard' });
if (ctx) render(ctx).catch((err) => setHTML(ctx.content, html`<div class="notice danger">Could not load your dashboard. ${err.message}</div>`));

async function render({ user, profile, content }) {
  const today = ymd();
  const from90 = addDays(today, -89);
  const week = mondayOf(today);
  const [plans, days, weights, checkin, notifs, unreadFeedback] = await Promise.all([
    loadPlans(user.id),
    loadDays(user.id, addDays(today, -27), today),
    q(supa.from('progress_records').select('record_date,weight_kg').eq('client_id', user.id).not('weight_kg', 'is', null).gte('record_date', from90).order('record_date')),
    q(supa.from('weekly_checkins').select('id,week_of,status,submitted_at').eq('client_id', user.id).order('week_of', { ascending: false }).limit(1).maybeSingle()),
    q(supa.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)),
    q(supa.from('coach_feedback').select('id', { count: 'exact', head: true }).eq('client_id', user.id).is('read_at', null)),
  ]);
  const t = targetsOf(plans.targets);
  const todayData = days.find((d) => d.date === today);
  const met = habitsMet(todayData, t);
  const thisWeek = days.filter((d) => d.date >= week);
  const loggedDays = thisWeek.filter((d) => d.logged).length;
  const workoutsThisWeek = thisWeek.filter((d) => d.workout).length;
  const plannedWorkouts = plans.workout?.days?.length || null;

  // Weight
  const wPoints = weights.map((w) => ({ date: w.record_date, value: Number(w.weight_kg) }));
  const latest = wPoints.at(-1)?.value ?? profile.start_weight ?? null;
  const start = profile.start_weight ?? wPoints[0]?.value ?? null;
  const target = profile.target_weight;
  let pct = null;
  if (start != null && target != null && latest != null && start !== target) pct = Math.max(0, Math.min(100, Math.round(((start - latest) / (start - target)) * 100)));

  const submittedThisWeek = checkin?.week_of === week;
  const nc = nextCheckin(profile.checkin_day ?? 0, submittedThisWeek, today);
  const first = (profile.full_name || '').split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const streakDays = streak(days);
  const feedbackCount = unreadFeedback?.count || 0;

  const items = [
    { key: 'workout', label: 'Workout', sub: met.workout ? 'Done' : plans.workout ? 'Today\'s session from your plan' : 'Train or mark a rest day' },
    { key: 'protein', label: 'Protein', sub: t.protein ? `${fmtNum(todayData.protein || 0)} of ${t.protein} g` : `${fmtNum(todayData.protein || 0)} g logged` },
    { key: 'calories', label: 'Calories', sub: t.calories ? `${fmtNum(todayData.calories || 0)} of ${fmtNum(t.calories)} kcal` : `${fmtNum(todayData.calories || 0)} kcal logged` },
    { key: 'steps', label: 'Steps', sub: `${fmtNum(todayData.steps || 0)} of ${fmtNum(t.steps)}` },
    { key: 'water', label: 'Hydration', sub: `${fmtNum((todayData.water || 0) / 1000, 1)} of ${fmtNum(t.water / 1000, 1)} L` },
    { key: 'sleep', label: 'Sleep', sub: `${fmtNum(todayData.sleep || 0, 1)} of ${t.sleep} hrs` },
  ];
  const doneCount = items.filter((i) => met[i.key]).length;

  setHTML(content, html`
    <div class="page-intro">
      <div>
        <h2>${greet}, ${first}.</h2>
        <p>${fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}${profile.plan_name ? html` · ${profile.plan_name}` : ''}${profile.plan_end ? html`, until ${fmtDate(profile.plan_end)}` : ''}</p>
      </div>
      <div class="cluster">
        <span class="tag tag-lime">${label('status', profile.status)}</span>
        ${streakDays > 1 ? html`<span class="tag">${streakDays}-day logging streak</span>` : ''}
      </div>
    </div>

    ${feedbackCount ? html`<a class="notice ok" href="/portal/checkins/" style="margin-bottom:16px;text-decoration:none"><span>You have ${feedbackCount} new message${feedbackCount > 1 ? 's' : ''} from your coach. <b>Read feedback</b></span></a>` : ''}
    ${nc.overdue ? html`<a class="notice warn" href="/portal/checkins/" style="margin-bottom:16px;text-decoration:none"><span>Your weekly check-in was due ${fmtDate(nc.date, { weekday: 'long' })}. <b>Submit it now</b></span></a>` : ''}

    <div class="stats">
      <div class="stat"><span class="stat-label">Current weight</span><span class="stat-value">${latest != null ? fmtNum(latest, 1) : '-'}<small>kg</small></span><span class="stat-sub">${wPoints.length ? `Logged ${fmtDate(wPoints.at(-1).date, { day: 'numeric', month: 'short' })}` : html`<a href="/portal/progress/">Add your weight</a>`}</span></div>
      <div class="stat"><span class="stat-label">Target weight</span><span class="stat-value">${target != null ? fmtNum(target, 1) : '-'}<small>kg</small></span>
        ${pct != null ? html`<div class="progress" title="${pct}% of the way"><span style="width:${pct}%"></span></div><span class="stat-sub">${pct}% of the way from ${fmtNum(start, 1)} kg</span>` : html`<span class="stat-sub">${target == null ? html`<a href="/portal/profile/">Set a target</a>` : ''}</span>`}</div>
      <div class="stat"><span class="stat-label">Daily calories</span><span class="stat-value">${t.calories ? fmtNum(t.calories) : '-'}<small>kcal</small></span><span class="stat-sub">${t.calories ? 'Your target' : 'Set by your coach'}</span></div>
      <div class="stat"><span class="stat-label">Protein</span><span class="stat-value">${t.protein ? t.protein : '-'}<small>g</small></span><span class="stat-sub">${t.carbs || t.fat ? `Carbs ${t.carbs ?? '-'} g · Fat ${t.fat ?? '-'} g` : 'Daily target'}</span></div>
      <div class="stat"><span class="stat-label">This week</span><span class="stat-value">${loggedDays}<small>of ${thisWeek.length} days logged</small></span><span class="stat-sub">${workoutsThisWeek} workout${workoutsThisWeek === 1 ? '' : 's'}${plannedWorkouts ? ` of ${plannedWorkouts} planned` : ''}</span></div>
      <a class="stat ${nc.today || nc.overdue ? 'accent' : ''}" href="/portal/checkins/"><span class="stat-label">Next check-in</span><span class="stat-value" style="font-size:1.35rem">${nc.today ? 'Today' : fmtDate(nc.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span class="stat-sub">${submittedThisWeek ? (checkin.status === 'reviewed' ? 'This week reviewed' : 'This week submitted, awaiting review') : `Every ${weekdayName(profile.checkin_day ?? 0)}`}</span></a>
    </div>

    <div class="panel-grid">
      <section class="panel" aria-labelledby="today-title">
        <div class="panel-head"><h2 id="today-title">Today's checklist</h2><span class="muted small">${doneCount} of ${items.length} done</span></div>
        <ul class="checklist-app">
          ${items.map((i) => html`<li><span class="tick ${met[i.key] ? 'on' : ''}" aria-hidden="true"></span><div class="what"><b>${i.label}</b><span>${i.sub}</span></div>${met[i.key] ? raw('<span class="sr-only">done</span>') : ''}</li>`)}
        </ul>
        <div class="cluster" style="margin-top:14px">
          <button class="btn btn-primary btn-sm" type="button" data-quicklog>Update checklist</button>
          <a class="btn btn-ghost btn-sm" href="/portal/logs/#food">Log food</a>
          <a class="btn btn-ghost btn-sm" href="/portal/logs/#workouts">Log workout</a>
        </div>
      </section>

      <section class="panel" aria-labelledby="plan-title">
        <div class="panel-head"><h2 id="plan-title">Your plan</h2><a class="small" href="/portal/plan/">Open plan</a></div>
        ${plans.workout ? html`<p style="margin:0 0 4px"><b>${plans.workout.title}</b></p><p class="muted small">${plans.workout.days.length} training day${plans.workout.days.length === 1 ? '' : 's'}: ${plans.workout.days.map((d) => d.name).filter(Boolean).slice(0, 4).join(', ')}</p>`
    : html`<p class="muted small">Your training plan will appear here once your coach assigns it.</p>`}
        <hr style="margin:14px 0">
        ${plans.nutrition ? html`<p style="margin:0 0 4px"><b>${plans.nutrition.title}</b></p><p class="muted small">${plans.nutrition.meals.length} meals${plans.nutrition.restrictions ? html` · ${plans.nutrition.restrictions}` : ''}</p>`
    : plans.targets?.diet_overview ? html`<p class="muted small pre-wrap" style="max-height:6.5em;overflow:hidden">${plans.targets.diet_overview}</p>` : html`<p class="muted small">Your nutrition plan will appear here once your coach assigns it.</p>`}
      </section>
    </div>

    <div class="panel-grid" style="margin-top:16px">
      <section class="panel" aria-labelledby="weight-title">
        <div class="panel-head"><h2 id="weight-title">Weight trend</h2>
          <div class="segmented" role="group" aria-label="Range"><button type="button" data-range="28" aria-pressed="true">4 weeks</button><button type="button" data-range="90" aria-pressed="false">3 months</button></div></div>
        <div data-weight-chart></div>
        <p class="small muted" style="margin:8px 0 0">The dashed line is your 7-day average, which smooths out day-to-day water swings.</p>
      </section>
      <section class="panel" aria-labelledby="notif-title">
        <div class="panel-head"><h2 id="notif-title">Updates</h2></div>
        ${notifs.length ? html`<div class="rows">${notifs.map((n) => html`<a class="row" href="${safeUrl(n.link) || '#'}" style="text-decoration:none"><div class="grow"><b>${n.title}</b><span>${timeAgo(n.created_at)}</span></div></a>`)}</div>`
    : html`<div class="empty"><h3>Nothing new</h3><p>Coach feedback, plan changes and reminders show up here.</p></div>`}
      </section>
    </div>

    <div class="panel-grid even" style="margin-top:16px">
      <section class="panel" aria-labelledby="cal-title">
        <div class="panel-head"><h2 id="cal-title">Calories, last 14 days</h2></div>
        <div data-cal-chart></div>
      </section>
      <section class="panel" aria-labelledby="habit-title">
        <div class="panel-head"><h2 id="habit-title">Habits, last 4 weeks</h2></div>
        <div data-habits></div>
      </section>
    </div>
  `);

  const chartWeight = (range) => {
    const fromD = addDays(today, -(range - 1));
    const pts = wPoints.filter((p) => p.date >= fromD);
    const avg = movingAverage(wPoints).filter((p) => p.date >= fromD);
    lineChart($('[data-weight-chart]'), [
      { name: 'Weigh-ins', points: pts.map((p) => ({ x: p.date, y: p.value })) },
      { name: '7-day average', points: avg.map((p) => ({ x: p.date, y: p.value })), dots: false },
    ], { unit: ' kg', goal: target, label: 'Weight trend', emptyText: 'Log your weight a few times a week to see your trend here.' });
  };
  chartWeight(28);
  $$('[data-range]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-range]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    chartWeight(Number(b.dataset.range));
  }));

  barChart($('[data-cal-chart]'), days.slice(-14).map((d) => ({ x: d.date, y: d.calories || 0 })), { target: t.calories, unit: ' kcal', label: 'Calories per day', emptyText: 'Log food or daily totals to see your calories here.' });
  renderHabits($('[data-habits]'), days, t);

  $('[data-quicklog]').addEventListener('click', () => openQuickLog({
    clientId: user.id, date: today, targets: t, plan: plans.targets, foodEntries: todayData.foodEntries,
    onSaved: () => render({ user, profile, content }),
  }));
}

function renderHabits(el, days, t) {
  const rows = [['workout', 'Workout'], ['protein', 'Protein'], ['steps', 'Steps'], ['water', 'Water'], ['sleep', 'Sleep']];
  const data = days.map((d) => ({ d, m: habitsMet(d, t) }));
  setHTML(el, html`<div class="habit-wrap"><table class="habit-grid" aria-label="Habits by day">
    <thead><tr><th scope="col"><span class="sr-only">Habit</span></th>${data.map(({ d }) => html`<th scope="col" title="${fmtDate(d.date)}"><span class="sr-only">${fmtDate(d.date)}</span>${parseYmd(d.date).getDay() === 1 ? fmtDate(d.date, { day: 'numeric' }) : ''}</th>`)}<th scope="col" class="small">Rate</th></tr></thead>
    <tbody>${rows.map(([k, name]) => {
    const hits = data.filter(({ m }) => m[k]).length;
    return html`<tr><th scope="row">${name}</th>${data.map(({ d, m }) => html`<td><span class="hcell ${m[k] ? 'on' : d.logged ? 'miss' : ''}" title="${name} ${fmtDate(d.date)}: ${m[k] ? 'met' : 'not met'}"></span></td>`)}<td class="small muted">${Math.round((hits / data.length) * 100)}%</td></tr>`;
  })}</tbody></table></div>`);
}
