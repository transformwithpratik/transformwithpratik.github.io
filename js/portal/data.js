// Per-day summaries built from daily_logs (checklist), food_logs and workout_logs.
import { supa, q } from '../lib/supabase.js';
import { ymd, addDays, parseYmd } from '../lib/util.js';

export const DEFAULT_TARGETS = { steps_target: 8000, water_ml_target: 2500, sleep_hours_target: 7 };

export function targetsOf(plan) {
  return {
    calories: plan?.daily_calories || null,
    protein: plan?.protein_g || null,
    carbs: plan?.carbs_g || null,
    fat: plan?.fat_g || null,
    steps: plan?.steps_target || DEFAULT_TARGETS.steps_target,
    water: plan?.water_ml_target || DEFAULT_TARGETS.water_ml_target,
    sleep: plan?.sleep_hours_target || DEFAULT_TARGETS.sleep_hours_target,
  };
}

export async function loadDays(clientId, from, to = ymd()) {
  const [daily, food, workouts] = await Promise.all([
    q(supa.from('daily_logs').select('*').eq('client_id', clientId).gte('log_date', from).lte('log_date', to)),
    q(supa.from('food_logs').select('log_date,calories,protein_g,carbs_g,fat_g').eq('client_id', clientId).gte('log_date', from).lte('log_date', to)),
    q(supa.from('workout_logs').select('log_date').eq('client_id', clientId).gte('log_date', from).lte('log_date', to)),
  ]);
  const days = {};
  for (let d = from; d <= to; d = addDays(d, 1)) days[d] = { date: d, calories: null, protein: null, carbs: null, fat: null, steps: null, water: null, sleep: null, workout: false, foodEntries: 0, logged: false, daily: null };
  for (const f of food) {
    const day = days[f.log_date]; if (!day) continue;
    day.foodEntries += 1;
    day.calories = (day.calories || 0) + (Number(f.calories) || 0);
    day.protein = (day.protein || 0) + (Number(f.protein_g) || 0);
    day.carbs = (day.carbs || 0) + (Number(f.carbs_g) || 0);
    day.fat = (day.fat || 0) + (Number(f.fat_g) || 0);
    day.logged = true;
  }
  for (const w of workouts) { const day = days[w.log_date]; if (day) { day.workout = true; day.logged = true; } }
  for (const l of daily) {
    const day = days[l.log_date]; if (!day) continue;
    day.daily = l;
    if (!day.foodEntries) { day.calories = l.calories; day.protein = l.protein_g; day.carbs = l.carbs_g; day.fat = l.fat_g; }
    day.steps = l.steps; day.water = l.water_ml; day.sleep = l.sleep_hours;
    if (l.workout_done) day.workout = true;
    day.logged = true;
  }
  return Object.values(days);
}

// Which checklist items a day met.
export function habitsMet(day, t) {
  return {
    workout: !!day.workout,
    protein: t.protein ? (day.protein || 0) >= t.protein * 0.9 : (day.protein || 0) > 0,
    calories: t.calories ? day.calories != null && day.calories > 0 && Math.abs(day.calories - t.calories) <= t.calories * 0.1 : day.calories > 0,
    steps: (day.steps || 0) >= t.steps,
    water: (day.water || 0) >= t.water,
    sleep: (day.sleep || 0) >= t.sleep,
  };
}

export function streak(days) {
  let n = 0;
  const sorted = [...days].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].logged) n++;
    else if (i === 0) continue; // today not logged yet does not break the streak
    else break;
  }
  return n;
}

export const weekdayName = (i) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i];

// Next check-in date for a client whose check-in day is checkinDay (0 = Sunday).
export function nextCheckin(checkinDay, submittedThisWeek, today = ymd()) {
  const d = parseYmd(today);
  const mondayOffset = (d.getDay() + 6) % 7;
  const monday = new Date(d); monday.setDate(d.getDate() - mondayOffset);
  const dueOffset = (checkinDay + 6) % 7;
  const due = new Date(monday); due.setDate(monday.getDate() + dueOffset + (submittedThisWeek ? 7 : 0));
  const dueStr = ymd(due);
  return { date: dueStr, overdue: !submittedThisWeek && dueStr < today, today: dueStr === today };
}
