// Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { bmrMifflin, bmrKatch, calorieTargets, proteinRange, bmi, whtr, waterEstimate, cmFromFtIn, kgFromLb, sumMacros, e1rm, movingAverage, validateBody } from '../js/lib/calc.js';

test('Mifflin-St Jeor matches the published equation', () => {
  // 10*80 + 6.25*180 - 5*30 + 5 = 1780
  assert.equal(bmrMifflin({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 }), 1780);
  // 10*60 + 6.25*165 - 5*28 - 161 = 1330.25
  assert.equal(bmrMifflin({ sex: 'female', weightKg: 60, heightCm: 165, age: 28 }), 1330.25);
});

test('Katch-McArdle uses lean mass', () => {
  assert.equal(Math.round(bmrKatch({ weightKg: 80, bodyFatPct: 20 })), Math.round(370 + 21.6 * 64));
});

test('calorie targets are internally consistent', () => {
  const r = calorieTargets({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'lose' });
  assert.ok(r.ok);
  assert.equal(r.bmr, 1780);
  assert.equal(r.tdee, Math.round(1780 * 1.55));
  assert.equal(r.target, Math.round((1780 * 1.55 * 0.8) / 10) * 10);
  const kcalFromMacros = r.protein * 4 + r.carbs * 4 + r.fat * 9;
  assert.ok(Math.abs(kcalFromMacros - r.target) <= 25, `macros ${kcalFromMacros} vs target ${r.target}`);
  assert.ok(r.weeklyKg < 0);
});

test('fat-loss target never drops below BMR or the safety floor', () => {
  const r = calorieTargets({ sex: 'female', age: 40, heightCm: 150, weightKg: 48, activity: 'sedentary', goal: 'lose' });
  assert.ok(r.ok);
  assert.ok(r.target >= 1200);
  assert.ok(r.target >= r.bmr - 10);
  assert.equal(r.floored, true);
});

test('protein uses a capped reference weight at higher BMI', () => {
  const r = calorieTargets({ sex: 'male', age: 35, heightCm: 170, weightKg: 110, activity: 'light', goal: 'lose' });
  // BMI-25 weight at 170 cm is 72.25 kg; 2.0 g/kg ~ 145 g rather than 220 g
  assert.equal(r.refWeight, 72.3);
  assert.ok(r.protein <= 150 && r.protein >= 140);
});

test('validation rejects impossible inputs', () => {
  const r = calorieTargets({ sex: 'male', age: 5, heightCm: 400, weightKg: 10, activity: 'moderate', goal: 'maintain' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.age && r.errors.height && r.errors.weight);
  assert.deepEqual(validateBody({ sex: 'female', age: 30, heightCm: 160, weightKg: 60, bodyFatPct: null }), {});
});

test('unit conversions', () => {
  assert.equal(Math.round(cmFromFtIn(5, 9) * 10) / 10, 175.3);
  assert.equal(Math.round(kgFromLb(176) * 10) / 10, 79.8);
});

test('BMI uses WHO and Asian-Indian cut-offs', () => {
  const r = bmi(70, 170); // 24.2
  assert.equal(r.value, 24.2);
  assert.equal(r.who, 'Healthy range');
  assert.equal(r.asian, 'Overweight');
});

test('waist-to-height ratio bands', () => {
  assert.equal(whtr(80, 170).level, 'healthy');
  assert.equal(whtr(90, 170).level, 'increased');
  assert.equal(whtr(105, 170).level, 'high');
  assert.equal(whtr(90, 170).targetWaist, 85);
});

test('water estimate adds exercise and heat', () => {
  assert.equal(waterEstimate({ sex: 'male' }).litres, 2);
  assert.equal(waterEstimate({ sex: 'female', exerciseMinutes: 60, hot: true }).litres, 2.7);
});

test('protein range is ordered and per-meal split is sensible', () => {
  const r = proteinRange({ weightKg: 70, heightCm: 175, goal: 'gain' });
  assert.ok(r.min < r.max);
  assert.ok(r.perMeal[0] >= 25 && r.perMeal[1] <= 60);
});

test('macro totals and estimated 1RM', () => {
  assert.deepEqual(sumMacros([{ calories: 100, protein_g: 10 }, { calories: '50', protein_g: null, fat_g: 2 }]), { calories: 150, protein_g: 10, carbs_g: 0, fat_g: 2 });
  assert.equal(e1rm(20, 10), 26.7);
  assert.equal(e1rm(100, 20), null);
});

test('moving average smooths daily weights', () => {
  const pts = [{ date: '2026-11-01', value: 80 }, { date: '2026-11-02', value: 81 }, { date: '2026-11-03', value: 79 }];
  assert.deepEqual(movingAverage(pts).map((p) => p.value), [80, 80.5, 80]);
});
