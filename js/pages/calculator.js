import { $, $$, html, setHTML, showErrors, clearErrors, fmtNum, initTabs, toast } from '../lib/util.js';
import { initSite } from '../lib/site.js';
import { ACTIVITY, GOALS, calorieTargets, proteinRange, bmi, whtr, waterEstimate, kgFromLb, cmFromFtIn, CM_PER_IN } from '../lib/calc.js';

initSite();

// ---------- Units ----------
let units = 'metric';
try { units = localStorage.getItem('gfp-units') || 'metric'; } catch { /* ignore */ }
function applyUnits() {
  const imp = units === 'imperial';
  $$('[data-units]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.units === units)));
  $$('[data-unit-weight]').forEach((el) => { el.textContent = imp ? 'lb' : 'kg'; });
  $$('[data-unit-length]').forEach((el) => { el.textContent = imp ? 'in' : 'cm'; });
  $$('[data-height-metric]').forEach((el) => { el.hidden = imp; });
  $$('[data-height-imperial]').forEach((el) => { el.hidden = !imp; });
}
$$('[data-units]').forEach((b) => b.addEventListener('click', () => {
  units = b.dataset.units;
  try { localStorage.setItem('gfp-units', units); } catch { /* ignore */ }
  applyUnits();
  recalcAll();
}));
applyUnits();

const val = (form, name) => { const v = form.elements[name]?.value; return v === '' || v == null ? null : Number(v); };
const weightKg = (form) => { const w = val(form, 'weight'); return w == null ? null : units === 'imperial' ? kgFromLb(w) : w; };
const heightCm = (form) => {
  if (units === 'imperial') { const ft = val(form, 'height_ft'); const inch = val(form, 'height_in') || 0; return ft == null ? null : cmFromFtIn(ft, inch); }
  return val(form, 'height');
};
const lengthCm = (form, name) => { const v = val(form, name); return v == null ? null : units === 'imperial' ? v * CM_PER_IN : v; };
const radio = (form, name) => form.querySelector(`input[name="${name}"]:checked`)?.value || null;

// ---------- Calories and macros ----------
const calcForm = $('#calcForm');
const actSel = $('#c-activity');
setHTML(actSel, [html`<option value="">Choose your activity level</option>`, ...ACTIVITY.map((a) => html`<option value="${a.key}">${a.label}</option>`)]);
let calcTouched = false;
let lastCalc = null;

function renderCalories(showValidation) {
  const input = {
    sex: radio(calcForm, 'sex'), age: val(calcForm, 'age'), heightCm: heightCm(calcForm), weightKg: weightKg(calcForm),
    bodyFatPct: val(calcForm, 'bodyfat'), activity: actSel.value, goal: radio(calcForm, 'goal'),
  };
  const r = calorieTargets(input);
  if (!r.ok) {
    if (showValidation) showErrors(calcForm, r.errors);
    return;
  }
  clearErrors(calcForm);
  lastCalc = { input, r };
  const pK = r.protein * 4; const cK = r.carbs * 4; const fK = r.fat * 9; const tot = pK + cK + fK || 1;
  const goal = GOALS[input.goal];
  const change = r.weeklyKg;
  setHTML($('[data-result]'), html`
    <p class="muted small" style="margin:0 0 6px">Daily target to ${goal.label.toLowerCase()}</p>
    <div class="big-num">${fmtNum(r.target)}<small>kcal / day</small></div>
    ${r.floored ? html`<p class="small" style="color:var(--lime);margin-top:10px">We kept this at a safe minimum. Losing faster than this needs medical supervision.</p>` : ''}
    <div class="macro-bar" aria-hidden="true"><span class="mb-p" style="width:${(pK / tot) * 100}%"></span><span class="mb-c" style="width:${(cK / tot) * 100}%"></span><span class="mb-f" style="width:${(fK / tot) * 100}%"></span></div>
    <div class="macro-grid">
      <div class="macro"><b>${r.protein} g</b><span><i style="background:var(--lime)"></i>Protein</span></div>
      <div class="macro"><b>${r.carbs} g</b><span><i style="background:var(--olive-2)"></i>Carbs</span></div>
      <div class="macro"><b>${r.fat} g</b><span><i style="background:#E9E2C7"></i>Fat</span></div>
    </div>
    <ul class="kv" style="margin-top:20px">
      <li><span>BMR (calories at rest)</span><span>${fmtNum(r.bmr)} kcal</span></li>
      ${r.bmrKatch ? html`<li><span>BMR with body fat (Katch-McArdle)</span><span>${fmtNum(r.bmrKatch)} kcal</span></li>` : ''}
      <li><span>Maintenance (TDEE, x${r.activityFactor})</span><span>${fmtNum(r.tdee)} kcal</span></li>
      <li><span>Adjustment for your goal</span><span>${r.target - r.tdee > 0 ? '+' : ''}${fmtNum(r.target - r.tdee)} kcal</span></li>
      <li><span>Expected change</span><span>${change === 0 ? 'Weight stays steady' : html`about ${fmtNum(Math.abs(change), 2)} kg per week ${change < 0 ? 'down' : 'up'}`}</span></li>
      <li><span>Protein basis</span><span>${r.proteinPerKg} g per kg of ${fmtNum(r.refWeight, 1)} kg</span></li>
    </ul>
    <p class="small muted" style="margin-top:16px">An estimate to start from. Track your weight for 2 to 3 weeks and adjust. If you have a medical condition, are pregnant or take medication, check with your doctor first.</p>
    <div class="cluster no-print" style="margin-top:20px">
      <a class="btn btn-primary" href="${bookLink(input)}">Get a personalised plan</a>
      <button class="btn btn-ghost" type="button" data-print>Save as PDF</button>
      <button class="btn btn-quiet" type="button" data-copy>Copy results</button>
    </div>
    <div class="print-only small" style="margin-top:16px">Calculated on ${new Date().toLocaleDateString('en-IN')} at transformwithpratik.github.io/calculator. Inputs: ${input.sex}, ${input.age} years, ${fmtNum(input.heightCm, 1)} cm, ${fmtNum(input.weightKg, 1)} kg, ${ACTIVITY.find((a) => a.key === input.activity).label}.</div>
  `);
  $('[data-print]')?.addEventListener('click', () => window.print());
  $('[data-copy]')?.addEventListener('click', copyResults);
}

function bookLink(input) {
  const p = new URLSearchParams({
    age: String(input.age), height_cm: String(Math.round(input.heightCm)), weight_kg: String(Math.round(input.weightKg * 10) / 10),
    goal: input.goal.startsWith('lose') ? 'fat_loss' : input.goal === 'gain' ? 'muscle_gain' : 'general_fitness',
  });
  return `/book?${p}`;
}

async function copyResults() {
  if (!lastCalc) return;
  const { r } = lastCalc;
  const text = `My numbers from GetFitWithPratik\nTarget: ${r.target} kcal/day\nProtein ${r.protein} g, carbs ${r.carbs} g, fat ${r.fat} g\nBMR ${r.bmr} kcal, maintenance ${r.tdee} kcal\nhttps://transformwithpratik.github.io/calculator`;
  try { await navigator.clipboard.writeText(text); toast('Results copied'); } catch { toast('Could not copy. Select the numbers and copy them manually.', 'error'); }
}

calcForm.addEventListener('submit', (e) => { e.preventDefault(); calcTouched = true; renderCalories(true); });
calcForm.addEventListener('input', () => { if (calcTouched) renderCalories(false); });
calcForm.addEventListener('change', () => { if (calcTouched) renderCalories(false); });

// ---------- Protein ----------
const pForm = $('#proteinForm');
let pTouched = false;
const VEG = [['Paneer, 100 g', 18], ['Firm tofu, 100 g', 17], ['Hung curd, 150 g', 15], ['Soya chunks, 30 g dry', 16], ['Moong dal, 1 katori (30 g dry)', 7], ['Toned milk, 1 glass', 8], ['Whey, 1 scoop', 23], ['Boiled chana, 1 cup', 13]];
function renderProtein(showValidation) {
  const w = weightKg(pForm); const h = heightCm(pForm);
  const errors = {};
  if (!(w >= 30 && w <= 300)) errors.weight = 'Enter a weight between 30 and 300 kg (66 to 661 lb).';
  if (Object.keys(errors).length) { if (showValidation) showErrors(pForm, errors); return; }
  clearErrors(pForm);
  const r = proteinRange({ weightKg: w, heightCm: h && h >= 120 && h <= 230 ? h : null, goal: radio(pForm, 'goal'), trains: pForm.elements.trains.checked });
  setHTML($('[data-protein-result]'), html`
    <p class="muted small" style="margin:0 0 6px">Daily protein</p>
    <div class="big-num">${r.min} to ${r.max}<small>g / day</small></div>
    <ul class="kv" style="margin-top:20px">
      <li><span>Per meal (3 to 4 meals)</span><span>${r.perMeal[0]} to ${r.perMeal[1]} g</span></li>
      <li><span>Based on</span><span>${r.lo} to ${r.hi} g per kg of ${fmtNum(r.ref, 1)} kg</span></li>
    </ul>
    <p style="margin:20px 0 8px"><b>Roughly how much protein is in</b></p>
    <ul class="kv">${VEG.map(([n, g]) => html`<li><span>${n}</span><span>${g} g</span></li>`)}</ul>
    <p class="small muted" style="margin-top:16px">Values are typical estimates; check labels. People with kidney disease should follow their doctor's protein advice.</p>
  `);
}
pForm.addEventListener('submit', (e) => { e.preventDefault(); pTouched = true; renderProtein(true); });
pForm.addEventListener('input', () => { if (pTouched) renderProtein(false); });

// ---------- BMI ----------
const bForm = $('#bmiForm');
let bTouched = false;
function renderBmi(showValidation) {
  const w = weightKg(bForm); const h = heightCm(bForm);
  const errors = {};
  if (!(w >= 30 && w <= 300)) errors.weight = 'Enter a weight between 30 and 300 kg (66 to 661 lb).';
  if (!(h >= 120 && h <= 230)) errors.height = 'Enter a height between 120 and 230 cm.';
  if (Object.keys(errors).length) { if (showValidation) showErrors(bForm, errors); return; }
  clearErrors(bForm);
  const r = bmi(w, h);
  const pos = Math.min(Math.max((r.value - 15) / (35 - 15), 0), 1) * 100;
  const toLb = (kg) => (units === 'imperial' ? `${fmtNum(kg * 2.2046, 0)} lb` : `${fmtNum(kg, 1)} kg`);
  setHTML($('[data-bmi-result]'), html`
    <p class="muted small" style="margin:0 0 6px">Your BMI</p>
    <div class="big-num">${fmtNum(r.value, 1)}</div>
    <div class="scale-wrap">
      <div class="scale" aria-hidden="true"><span style="background:#8FB3C9;flex:3.5"></span><span style="background:var(--lime);flex:4.5"></span><span style="background:#E8C766;flex:2"></span><span style="background:#E58E6D;flex:10"></span></div>
      <span class="scale-marker" style="left:${pos}%" aria-hidden="true"></span>
      <div class="scale-labels"><span>15</span><span>18.5</span><span>23</span><span>25</span><span>35</span></div>
    </div>
    <ul class="kv" style="margin-top:18px">
      <li><span>Asian-Indian cut-offs</span><span>${r.asian}</span></li>
      <li><span>WHO international cut-offs</span><span>${r.who}</span></li>
      <li><span>Healthy weight for your height</span><span>${toLb(r.healthyMin)} to ${toLb(r.healthyMaxAsian)}</span></li>
    </ul>
    <p class="small muted" style="margin-top:16px">Indian adults tend to carry more body fat at the same BMI, which is why Indian guidelines treat 23 to 24.9 as overweight and 25 or above as obesity. The scale above uses those cut-offs.</p>
  `);
}
bForm.addEventListener('submit', (e) => { e.preventDefault(); bTouched = true; renderBmi(true); });
bForm.addEventListener('input', () => { if (bTouched) renderBmi(false); });

// ---------- Waist-to-height ----------
const wForm = $('#whtrForm');
let wTouched = false;
function renderWhtr(showValidation) {
  const waist = lengthCm(wForm, 'waist'); const h = heightCm(wForm);
  const errors = {};
  if (!(waist >= 40 && waist <= 200)) errors.waist = 'Enter a waist between 40 and 200 cm (16 to 79 in).';
  if (!(h >= 120 && h <= 230)) errors.height = 'Enter a height between 120 and 230 cm.';
  if (Object.keys(errors).length) { if (showValidation) showErrors(wForm, errors); return; }
  clearErrors(wForm);
  const r = whtr(waist, h);
  const target = units === 'imperial' ? `${fmtNum(r.targetWaist / CM_PER_IN, 1)} in` : `${r.targetWaist} cm`;
  setHTML($('[data-whtr-result]'), html`
    <p class="muted small" style="margin:0 0 6px">Waist-to-height ratio</p>
    <div class="big-num">${r.value.toFixed(2)}</div>
    <p style="margin-top:12px"><span class="tag ${r.level === 'healthy' ? 'tag-lime' : r.level === 'high' ? 'tag-danger' : 'tag-warn'}">${r.band}</span></p>
    <ul class="kv" style="margin-top:14px">
      <li><span>Below 0.5</span><span>Healthy</span></li>
      <li><span>0.5 to 0.59</span><span>Increased risk</span></li>
      <li><span>0.6 or more</span><span>High risk</span></li>
      <li><span>Waist for a ratio of 0.5</span><span>${target}</span></li>
    </ul>
    <p class="small muted" style="margin-top:16px">Waist size reflects fat around the organs, which is more closely linked to heart disease and type 2 diabetes than weight alone.</p>
  `);
}
wForm.addEventListener('submit', (e) => { e.preventDefault(); wTouched = true; renderWhtr(true); });
wForm.addEventListener('input', () => { if (wTouched) renderWhtr(false); });

// ---------- Water ----------
const waForm = $('#waterForm');
function renderWater() {
  const mins = Math.min(Math.max(val(waForm, 'exercise') || 0, 0), 300);
  const r = waterEstimate({ sex: radio(waForm, 'sex'), exerciseMinutes: mins, hot: waForm.elements.hot.checked });
  setHTML($('[data-water-result]'), html`
    <p class="muted small" style="margin:0 0 6px">Drinks today</p>
    <div class="big-num">${r.litres}<small>litres</small></div>
    <p class="muted" style="margin-top:10px">About ${r.glasses} glasses of 250 ml, spread through the day.</p>
    <ul class="kv" style="margin-top:14px">
      <li><span>Baseline</span><span>${radio(waForm, 'sex') === 'female' ? '1.6' : '2.0'} L</span></li>
      <li><span>Exercise</span><span>+${fmtNum((mins / 60) * 0.6, 1)} L</span></li>
      <li><span>Heat</span><span>${waForm.elements.hot.checked ? '+0.5 L' : 'none'}</span></li>
    </ul>
    <p class="small muted" style="margin-top:16px">A rough guide. Pale-yellow urine is a simple sign you are drinking enough. If you have heart or kidney problems, follow your doctor's fluid advice.</p>
  `);
}
waForm.addEventListener('submit', (e) => { e.preventDefault(); renderWater(); });
waForm.addEventListener('change', renderWater);
waForm.addEventListener('input', renderWater);

function recalcAll() {
  if (calcTouched) renderCalories(false);
  if (pTouched) renderProtein(false);
  if (bTouched) renderBmi(false);
  if (wTouched) renderWhtr(false);
}

// ---------- Tabs with deep links (#protein, #bmi, ...) ----------
const tabs = initTabs($('[data-tabs]'), (key) => { if (history.replaceState) history.replaceState(null, '', key === 'calories' ? location.pathname : `#${key}`); });
const fromHash = location.hash.replace('#', '');
if (['protein', 'bmi', 'whtr', 'water'].includes(fromHash)) tabs.select(fromHash);
