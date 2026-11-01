// Test fixture data for the e2e run. Content tables come from the same sources as the real
// seed; people, logs and plans are invented test fixtures and never leave the test process.
import { macrosFor } from '../../scripts/content/ingredients.mjs';
import { RECIPES } from '../../scripts/content/recipes.mjs';
import { EXERCISES } from '../../scripts/content/exercises.mjs';
import { RESOURCES } from '../../scripts/content/resources.mjs';

export const ADMIN = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'coach@example.com', password: 'coach-pass-123' };
export const CLIENT = { id: 'cccccccc-0000-4000-8000-000000000002', email: 'client@example.com', password: 'client-pass-123' };
export const PENDING = { id: 'dddddddd-0000-4000-8000-000000000003', email: 'pending@example.com', password: 'pending-pass-123' };

const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return ymd(d); };
const iso = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString(); };
const weekStart = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7 * n); return ymd(d); };

export function buildSeed(settings) {
  const t = {};
  t.site_settings = Object.entries(settings).map(([key, value]) => ({ key, value }));
  t.recipes = RECIPES.map((r, i) => {
    const m = macrosFor(r.ingredients, r.servings);
    return { id: `rec-${i}`, slug: r.slug, title: r.title, summary: r.summary, servings: r.servings, prep_minutes: r.prep, cook_minutes: r.cook, ...m, ingredients: r.ingredients.map((x) => ({ item: x.label, grams: x.g || null })), steps: r.steps, categories: r.categories, diet_tags: r.diet, tips: r.tips, sort_order: i, is_published: true, image_url: null, created_at: iso(30) };
  });
  t.exercises = EXERCISES.map((e, i) => ({ id: `ex-${i}`, ...e, video_url: null, is_published: true, sort_order: i }));
  t.resources = RESOURCES.map((r, i) => ({ id: `res-${i}`, ...r, kind: 'guide', access: 'public', is_published: true, sort_order: i }));
  t.foods = [
    { id: 'f1', name: 'Paneer', category: 'protein', serving_label: '100 g', serving_g: 100, calories: 265, protein_g: 18.3, carbs_g: 1.2, fat_g: 20.8 },
    { id: 'f2', name: 'Whey protein', category: 'protein', serving_label: '1 scoop (30 g)', serving_g: 30, calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5 },
    { id: 'f3', name: 'Cooked white rice', category: 'grains', serving_label: '1 cup cooked (150 g)', serving_g: 150, calories: 195, protein_g: 4, carbs_g: 42.3, fat_g: 0.5 },
    { id: 'f4', name: 'Moong dal (dry weight)', category: 'pulses', serving_label: '30 g dry', serving_g: 30, calories: 104, protein_g: 7.4, carbs_g: 18.8, fat_g: 0.4 },
  ];
  t.transformations = [
    { id: 'tf1', slug: 'test-fat-loss', client_display_name: 'Test client A', goal_category: 'fat_loss', duration_weeks: 16, start_weight_kg: 88, end_weight_kg: 79, headline: 'Fixture story for layout testing', goal: 'Lose fat around a desk job', summary: 'Fixture summary paragraph.\n\nSecond paragraph.', testimonial: 'Fixture quote used only in tests.', before_image_url: '/tests/e2e/pixel.png', after_image_url: '/tests/e2e/pixel.png', consent_confirmed: true, status: 'published', published_at: iso(10), sort_order: 0, created_at: iso(10) },
    { id: 'tf2', slug: 'test-muscle', client_display_name: 'Test client B', goal_category: 'muscle_gain', duration_weeks: 24, start_weight_kg: 62, end_weight_kg: 68, headline: 'Second fixture story', summary: 'Fixture.', consent_confirmed: true, status: 'published', published_at: iso(5), sort_order: 1, created_at: iso(5) },
    { id: 'tf3', slug: 'test-draft', client_display_name: 'Draft client', goal_category: 'recomposition', status: 'draft', consent_confirmed: false, sort_order: 2, created_at: iso(2) },
  ];
  t.feedback = [
    { id: 'fb1', name: 'Fixture Reviewer', email: 'r@example.com', rating: 5, relationship: 'current_client', feedback: 'Fixture review text, approved and public.', status: 'approved', consent_public: true, display_name: 'Fixture R.', featured: true, created_at: iso(20) },
    { id: 'fb2', name: 'Pending Reviewer', email: 'p@example.com', rating: 4, relationship: 'follower', feedback: 'Awaiting moderation.', status: 'pending', consent_public: true, created_at: iso(1) },
  ];
  t.profiles = [
    { id: ADMIN.id, email: ADMIN.email, full_name: 'Coach Fixture', role: 'admin', status: 'active', checkin_day: 0, email_notifications: true, created_at: iso(200) },
    { id: CLIENT.id, email: CLIENT.email, full_name: 'Client Fixture', phone: '9999999999', role: 'client', status: 'active', goal: 'fat_loss', start_weight: 84, target_weight: 76, height_cm: 175, sex: 'male', date_of_birth: '1994-05-01', diet_preference: 'vegetarian', plan_name: '3-Month Standard', plan_start: daysAgo(40), plan_end: daysAgo(-5), checkin_day: 0, email_notifications: true, coach_id: ADMIN.id, approved_at: iso(40), created_at: iso(42) },
    { id: PENDING.id, email: PENDING.email, full_name: 'Pending Fixture', role: 'client', status: 'pending', checkin_day: 0, email_notifications: true, created_at: iso(1) },
  ];
  t.plans = [{ id: 'pl1', client_id: CLIENT.id, name: 'Coaching Plan', daily_calories: 2100, protein_g: 140, carbs_g: 230, fat_g: 65, fiber_g: 30, steps_target: 9000, water_ml_target: 3000, sleep_hours_target: 7.5, coach_notes: 'Keep protein high on rest days too.', custom_log_fields: [{ key: 'creatine', label: 'Creatine taken', type: 'checkbox' }], is_active: true, updated_at: iso(3), created_at: iso(40) }];
  t.workout_plans = [{ id: 'wp1', client_id: CLIENT.id, title: 'Upper / lower, 4 days', notes: 'Stop 1 to 2 reps before failure.', is_active: true, starts_on: daysAgo(40), days: [
    { name: 'Upper A', focus: 'Push emphasis', exercises: [{ name: 'Barbell bench press', sets: 3, reps: '6-8', rest: '2-3 min' }, { name: 'One-arm dumbbell row', sets: 3, reps: '8-12', rest: '90 s', notes: 'Pause at the top' }] },
    { name: 'Lower A', focus: 'Squat emphasis', exercises: [{ name: 'Goblet squat', sets: 3, reps: '8-10', rest: '2 min', substitutions: 'Leg press' }] },
  ], updated_at: iso(3), created_at: iso(40) }];
  t.nutrition_plans = [{ id: 'np1', client_id: CLIENT.id, title: 'Vegetarian fat-loss meals', notes: 'Roughly 2,100 kcal.', restrictions: 'No mushrooms', is_active: true, meals: [
    { name: 'Breakfast', time: '8:30', calories: 450, protein_g: 30, items: [{ food: 'Moong dal chilla', quantity: '2' }, { food: 'Curd', quantity: '150 g' }] },
    { name: 'Lunch', time: '13:30', calories: 600, protein_g: 35, items: [{ food: 'Rajma', quantity: '1 katori' }, { food: 'Rice', quantity: '1 cup' }] },
  ], substitutions: [{ swap: 'Paneer 100 g', with: 'Tofu 150 g' }], updated_at: iso(3), created_at: iso(40) }];
  t.food_logs = [];
  t.workout_logs = [];
  t.progress_records = [];
  t.daily_logs = [];
  for (let i = 0; i < 28; i += 1) {
    const d = daysAgo(i);
    if (i % 3 !== 2) {
      t.food_logs.push({ id: `fl-${i}-1`, client_id: CLIENT.id, log_date: d, meal: 'breakfast', food_name: 'Moong dal chilla with paneer', quantity: 1, unit: 'serving', calories: 403, protein_g: 24.5, carbs_g: 40.5, fat_g: 16.2, created_at: iso(i) });
      t.food_logs.push({ id: `fl-${i}-2`, client_id: CLIENT.id, log_date: d, meal: 'lunch', food_name: 'Rajma rice', quantity: 1, unit: 'bowl', calories: 610, protein_g: 22, carbs_g: 100, fat_g: 9, created_at: iso(i) });
    }
    if (i % 2 === 0) t.workout_logs.push({ id: `wl-${i}`, client_id: CLIENT.id, log_date: d, exercise: i % 4 === 0 ? 'Barbell bench press' : 'Goblet squat', sets: 3, reps: 8, weight_kg: 50 + (28 - i) * 0.5, est_1rm: Math.round((50 + (28 - i) * 0.5) * (1 + 8 / 30) * 10) / 10, created_at: iso(i) });
    if (i % 2 === 1) t.progress_records.push({ id: `pr-${i}`, client_id: CLIENT.id, record_date: d, weight_kg: Math.round((80 + i * 0.12) * 10) / 10, waist_cm: i % 7 === 1 ? 88 + i * 0.1 : null, source: 'manual', created_at: iso(i) });
    t.daily_logs.push({ id: `dl-${i}`, client_id: CLIENT.id, log_date: d, steps: 6000 + ((i * 937) % 5000), water_ml: 2000 + (i % 4) * 300, sleep_hours: 6.5 + (i % 3) * 0.5, workout_done: i % 2 === 0, custom_data: { creatine: i % 2 === 0 }, created_at: iso(i) });
  }
  t.weekly_checkins = [
    { id: 'wc1', client_id: CLIENT.id, week_of: weekStart(1), submitted_at: iso(7), weight_kg: 80.6, avg_weight_kg: 80.8, workout_adherence: 90, nutrition_adherence: 80, sleep_hours: 7, sleep_quality: 4, energy: 4, hunger: 3, stress: 2, steps_avg: 8500, wins: 'Hit every session', challenges: 'Office party on Friday', status: 'reviewed', reviewed_at: iso(6), reviewed_by: ADMIN.id },
    { id: 'wc2', client_id: CLIENT.id, week_of: weekStart(2), submitted_at: iso(14), weight_kg: 81.2, workout_adherence: 75, nutrition_adherence: 70, sleep_hours: 6.5, energy: 3, hunger: 4, stress: 3, wins: 'Started walking after lunch', challenges: 'Travel', status: 'pending_review' },
  ];
  t.coach_feedback = [{ id: 'cf1', client_id: CLIENT.id, checkin_id: 'wc1', author_id: ADMIN.id, body: 'Great week. Keep the walks going.', created_at: iso(6), read_at: null }];
  t.progress_photos = [{ id: 'ph1', client_id: CLIENT.id, taken_on: daysAgo(7), pose: 'front', path: `${CLIENT.id}/front.jpg`, checkin_id: 'wc1', created_at: iso(7) }];
  t.notifications = [{ id: 'n1', user_id: CLIENT.id, kind: 'feedback', title: 'Your coach replied to your check-in', body: 'Great week.', link: '/portal/checkins/', read_at: null, created_at: iso(6) }];
  t.coach_notes = [{ id: 'cn1', client_id: CLIENT.id, author_id: ADMIN.id, body: 'Prefers morning sessions.', pinned: false, created_at: iso(30) }];
  t.client_files = [];
  t.saved_foods = [];
  t.favorites = [];
  t.leads = [
    { id: 'ld1', name: 'Lead Fixture', email: 'lead@example.com', whatsapp: '9876543210', age: 31, height_cm: 170, weight_kg: 82, goal: 'fat_loss', target_weight_kg: 74, experience: 'beginner', workout_location: 'gym', diet_preference: 'vegetarian', work_schedule: '9 to 7, hybrid', availability: 'Mornings', biggest_challenge: 'Consistency', plan_interest: '3-Month Standard', message: 'Fixture lead message', source: 'website', consent: true, status: 'new', created_at: iso(1), updated_at: iso(1) },
    { id: 'ld2', name: 'Old Lead', email: 'old@example.com', goal: 'muscle_gain', source: 'website', consent: true, status: 'contacted', next_follow_up: daysAgo(-2), created_at: iso(12), updated_at: iso(10) },
  ];
  t.lead_events = [{ id: 'le1', lead_id: 'ld2', actor_id: ADMIN.id, kind: 'status_changed', from_status: 'new', to_status: 'contacted', note: null, created_at: iso(10) }];
  t.client_invites = [];
  t.payments = [{ id: 'pay1', client_id: CLIENT.id, amount: 9999, currency: 'INR', paid_on: daysAgo(40), method: 'upi', plan_name: '3-Month Standard', period_start: daysAgo(40), period_end: daysAgo(-50), created_at: iso(40) }];
  t.email_outbox = [
    { id: 1, created_at: iso(1), to_email: 'transformwithpratik@gmail.com', template: 'coach_new_lead', subject: 'New enquiry: Lead Fixture', status: 'failed', attempts: 5, last_error: 'No email provider configured', data: {} },
    { id: 2, created_at: iso(1), to_email: 'lead@example.com', template: 'lead_ack', subject: 'Thanks for getting in touch', status: 'sent', attempts: 1, sent_at: iso(1), data: {} },
  ];
  t.audit_log = [{ id: 1, at: iso(2), actor_id: ADMIN.id, action: 'update', table_name: 'profiles', record_id: CLIENT.id, changes: { status: { from: 'pending', to: 'active' } } }];
  return {
    tables: t,
    seq: 100,
    users: [ADMIN, CLIENT, PENDING].map((u) => ({ ...u })),
  };
}
