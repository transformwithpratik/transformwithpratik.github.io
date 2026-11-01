// Pure calculation functions used by the calculators and the coach tools.
// No DOM access here, so they can be unit tested with `node --test tests/`.

export const ACTIVITY = [
  { key: 'sedentary', factor: 1.2, label: 'Desk job, little exercise' },
  { key: 'light', factor: 1.375, label: 'Light: exercise 1 to 3 days a week' },
  { key: 'moderate', factor: 1.55, label: 'Moderate: exercise 3 to 5 days a week' },
  { key: 'very', factor: 1.725, label: 'Very active: hard exercise 6 to 7 days' },
  { key: 'extra', factor: 1.9, label: 'Extra active: physical job plus training' },
];

export const GOALS = {
  lose: { label: 'Lose fat', adjust: -0.2, protein: 2.0 },
  lose_slow: { label: 'Lose fat slowly', adjust: -0.1, protein: 1.8 },
  maintain: { label: 'Maintain', adjust: 0, protein: 1.6 },
  gain: { label: 'Build muscle', adjust: 0.1, protein: 1.8 },
};

export const LB_PER_KG = 2.2046226218;
export const CM_PER_IN = 2.54;
export const kgFromLb = (lb) => lb / LB_PER_KG;
export const cmFromFtIn = (ft, inch) => (Number(ft) * 12 + Number(inch || 0)) * CM_PER_IN;

const round = (n, step = 1) => Math.round(n / step) * step;

// Mifflin-St Jeor (Am J Clin Nutr 1990;51:241-7)
export function bmrMifflin({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

// Katch-McArdle, only when body fat is known
export function bmrKatch({ weightKg, bodyFatPct }) {
  const lbm = weightKg * (1 - bodyFatPct / 100);
  return 370 + 21.6 * lbm;
}

export function validateBody({ sex, age, heightCm, weightKg, bodyFatPct }) {
  const e = {};
  if (!['male', 'female'].includes(sex)) e.sex = 'Choose male or female.';
  if (!(age >= 16 && age <= 90)) e.age = 'Enter an age between 16 and 90.';
  if (!(heightCm >= 120 && heightCm <= 230)) e.height = 'Enter a height between 120 and 230 cm (3 ft 11 in to 7 ft 6 in).';
  if (!(weightKg >= 30 && weightKg <= 300)) e.weight = 'Enter a weight between 30 and 300 kg (66 to 661 lb).';
  if (bodyFatPct != null && bodyFatPct !== '' && !(bodyFatPct >= 3 && bodyFatPct <= 60)) e.bodyfat = 'Body fat should be between 3 and 60 percent, or leave it blank.';
  return e;
}

// Reference weight for protein: actual weight, capped at the weight for BMI 25 when BMI is
// higher, so targets for people with more body fat stay realistic.
export function proteinReferenceWeight(weightKg, heightCm) {
  const h = heightCm / 100;
  return Math.min(weightKg, 25 * h * h);
}

export function calorieTargets(input) {
  const { sex, age, heightCm, weightKg, activity = 'moderate', goal = 'maintain' } = input;
  const bodyFatPct = input.bodyFatPct === '' ? null : input.bodyFatPct;
  const errors = validateBody({ sex, age, heightCm, weightKg, bodyFatPct });
  const act = ACTIVITY.find((a) => a.key === activity);
  const g = GOALS[goal];
  if (!act) errors.activity = 'Choose an activity level.';
  if (!g) errors.goal = 'Choose a goal.';
  if (Object.keys(errors).length) return { ok: false, errors };

  const bmr = bmrMifflin({ sex, weightKg, heightCm, age });
  const bmrKatchValue = bodyFatPct ? bmrKatch({ weightKg, bodyFatPct }) : null;
  const tdee = bmr * act.factor;
  const floor = sex === 'female' ? 1200 : 1500;
  let target = tdee * (1 + g.adjust);
  let floored = false;
  if (g.adjust < 0 && target < Math.max(floor, bmr)) { target = Math.max(floor, bmr); floored = true; }
  target = round(target, 10);

  const refWeight = bodyFatPct
    ? Math.min(proteinReferenceWeight(weightKg, heightCm), weightKg * (1 - bodyFatPct / 100) / 0.8)
    : proteinReferenceWeight(weightKg, heightCm);
  const protein = round(refWeight * g.protein, 5);
  const fat = round(Math.max((target * 0.25) / 9, weightKg * 0.6), 5);
  const carbs = Math.max(0, round((target - protein * 4 - fat * 9) / 4, 5));
  const weeklyKg = ((target - tdee) * 7) / 7700;

  return {
    ok: true,
    bmr: Math.round(bmr),
    bmrKatch: bmrKatchValue ? Math.round(bmrKatchValue) : null,
    tdee: Math.round(tdee),
    target,
    adjustPct: Math.round(g.adjust * 100),
    floored,
    protein, fat, carbs,
    proteinPerKg: g.protein,
    refWeight: Math.round(refWeight * 10) / 10,
    weeklyKg: Math.round(weeklyKg * 100) / 100,
    activityFactor: act.factor,
  };
}

export function proteinRange({ weightKg, heightCm, goal = 'maintain', trains = true }) {
  const ref = heightCm ? proteinReferenceWeight(weightKg, heightCm) : weightKg;
  let lo = 1.2; let hi = 1.6;
  if (trains) { lo = 1.6; hi = 2.2; }
  if (goal === 'lose' && trains) { lo = 1.8; hi = 2.2; }
  if (goal === 'maintain' && trains) { lo = 1.4; hi = 2.0; }
  const min = round(ref * lo, 5);
  const max = round(ref * hi, 5);
  return { min, max, ref: Math.round(ref * 10) / 10, lo, hi, perMeal: [round(min / 4, 5), round(max / 3, 5)] };
}

// WHO adult categories plus the lower cut-offs recommended for Asian Indians
// (WHO Expert Consultation, Lancet 2004; Misra et al., JAPI 2009).
export function bmi(weightKg, heightCm) {
  const h = heightCm / 100;
  const value = weightKg / (h * h);
  const who = value < 18.5 ? 'Underweight' : value < 25 ? 'Healthy range' : value < 30 ? 'Overweight' : 'Obesity';
  const asian = value < 18.5 ? 'Underweight' : value < 23 ? 'Healthy range' : value < 25 ? 'Overweight' : 'Obesity';
  return { value: Math.round(value * 10) / 10, who, asian, healthyMin: Math.round(18.5 * h * h * 10) / 10, healthyMaxAsian: Math.round(22.9 * h * h * 10) / 10, healthyMaxWho: Math.round(24.9 * h * h * 10) / 10 };
}

// Waist-to-height ratio bands used in NICE guidance: under 0.5 healthy, 0.5 to 0.59 increased, 0.6 or more high.
export function whtr(waistCm, heightCm) {
  const value = waistCm / heightCm;
  const band = value < 0.4 ? 'Low, check with a doctor if you are also underweight' : value < 0.5 ? 'Healthy' : value < 0.6 ? 'Increased health risk' : 'High health risk';
  const level = value < 0.4 ? 'low' : value < 0.5 ? 'healthy' : value < 0.6 ? 'increased' : 'high';
  return { value: Math.round(value * 100) / 100, band, level, targetWaist: Math.round(heightCm * 0.5) };
}

// Rough daily fluid estimate. Baseline from EFSA adequate intakes for total water
// (2.0 L women, 2.5 L men, of which about 80% comes from drinks), plus sweat losses.
export function waterEstimate({ sex, exerciseMinutes = 0, hot = false }) {
  const totalWater = sex === 'female' ? 2.0 : 2.5;
  let drinks = totalWater * 0.8;
  drinks += (exerciseMinutes / 60) * 0.6;
  if (hot) drinks += 0.5;
  const litres = Math.round(drinks * 10) / 10;
  return { litres, glasses: Math.round((litres * 1000) / 250) };
}

export function bmiBand(value) {
  return value < 18.5 ? 'under' : value < 23 ? 'healthy' : value < 25 ? 'over' : 'obese';
}

// Totals for an array of food log rows.
export function sumMacros(rows) {
  return rows.reduce((t, r) => ({
    calories: t.calories + (Number(r.calories) || 0),
    protein_g: t.protein_g + (Number(r.protein_g) || 0),
    carbs_g: t.carbs_g + (Number(r.carbs_g) || 0),
    fat_g: t.fat_g + (Number(r.fat_g) || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
}

// Estimated one-rep max (Epley), used for strength trends.
export const e1rm = (weight, reps) => (weight > 0 && reps >= 1 && reps <= 12 ? Math.round(weight * (1 + reps / 30) * 10) / 10 : null);

// Seven-day moving average of a [{date, value}] series sorted by date.
export function movingAverage(points, days = 7) {
  return points.map((p, i) => {
    const from = new Date(p.date).getTime() - (days - 1) * 86400000;
    const win = points.slice(0, i + 1).filter((q) => new Date(q.date).getTime() >= from);
    return { date: p.date, value: Math.round((win.reduce((s, q) => s + q.value, 0) / win.length) * 10) / 10 };
  });
}
