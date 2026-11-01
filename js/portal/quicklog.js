// Daily checklist editor (steps, water, sleep, workout, manual calories/protein, coach-defined fields).
// Saves one row per day in daily_logs, the table the original portal used.
import { supa, q } from '../lib/supabase.js';
import { html, raw, fmtDate, intOrNull, numOrNull, toast, esc } from '../lib/util.js';
import { openModal } from '../lib/portal.js';

export async function openQuickLog({ clientId, date, targets, plan, foodEntries = 0, onSaved }) {
  const existing = await q(supa.from('daily_logs').select('*').eq('client_id', clientId).eq('log_date', date).maybeSingle());
  const l = existing || {};
  const custom = Array.isArray(plan?.custom_log_fields) ? plan.custom_log_fields : [];
  const body = html`
    <p class="muted small" style="margin:0">${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <fieldset>
      <legend>Did you work out?</legend>
      <div class="choices stretch">
        <label class="choice"><input type="radio" name="workout_done" value="true" ${l.workout_done === true ? raw('checked') : ''}><span>Yes</span></label>
        <label class="choice"><input type="radio" name="workout_done" value="false" ${l.workout_done === false ? raw('checked') : ''}><span>Rest day / no</span></label>
      </div>
    </fieldset>
    <div class="form-row">
      <div class="field"><label for="ql-steps">Steps</label><input class="input" id="ql-steps" name="steps" type="number" inputmode="numeric" min="0" max="100000" value="${l.steps ?? ''}" placeholder="Target ${targets.steps}"></div>
      <div class="field"><label for="ql-water">Water</label><div class="input-group"><input class="input" id="ql-water" name="water_ml" type="number" inputmode="numeric" min="0" max="10000" step="50" value="${l.water_ml ?? ''}" placeholder="${targets.water}"><span class="suffix">ml</span></div>
        <div class="cluster" style="--gap:6px;margin-top:6px"><button class="btn btn-quiet btn-sm" type="button" data-add-water="250">+250</button><button class="btn btn-quiet btn-sm" type="button" data-add-water="500">+500</button></div></div>
      <div class="field"><label for="ql-sleep">Sleep last night</label><div class="input-group"><input class="input" id="ql-sleep" name="sleep_hours" type="number" inputmode="decimal" min="0" max="24" step="0.25" value="${l.sleep_hours ?? ''}" placeholder="${targets.sleep}"><span class="suffix">hrs</span></div></div>
    </div>
    ${foodEntries ? html`<p class="notice small">Calories and macros for this day come from your ${foodEntries} food log entr${foodEntries === 1 ? 'y' : 'ies'}.</p>` : html`
    <p class="small muted" style="margin:0">Not logging individual foods? Enter your day's totals here instead.</p>
    <div class="form-row">
      <div class="field"><label for="ql-cal">Calories</label><input class="input" id="ql-cal" name="calories" type="number" inputmode="numeric" min="0" max="10000" value="${l.calories ?? ''}" placeholder="${targets.calories || ''}"></div>
      <div class="field"><label for="ql-pro">Protein (g)</label><input class="input" id="ql-pro" name="protein_g" type="number" inputmode="numeric" min="0" max="600" value="${l.protein_g ?? ''}" placeholder="${targets.protein || ''}"></div>
      <div class="field"><label for="ql-carb">Carbs (g)</label><input class="input" id="ql-carb" name="carbs_g" type="number" inputmode="numeric" min="0" max="1500" value="${l.carbs_g ?? ''}"></div>
      <div class="field"><label for="ql-fat">Fat (g)</label><input class="input" id="ql-fat" name="fat_g" type="number" inputmode="numeric" min="0" max="500" value="${l.fat_g ?? ''}"></div>
    </div>`}
    ${custom.length ? html`<div class="form-row">${custom.map((f) => html`<div class="field"><label for="cf-${f.key}">${f.label}</label><input class="input" id="cf-${f.key}" name="custom_${f.key}" type="${f.type === 'number' ? 'number' : 'text'}" value="${(l.custom_data || {})[f.key] ?? ''}" placeholder="${f.placeholder || ''}"></div>`)}</div>` : ''}
    <div class="field"><label for="ql-notes">Notes for the day</label><textarea class="input" id="ql-notes" name="notes" maxlength="1000" style="min-height:80px" placeholder="Energy, cravings, anything you want your coach to know">${l.notes || ''}</textarea></div>`;
  openModal({
    title: 'Daily checklist',
    body,
    submit: 'Save',
    onSubmit: async (form) => {
      const f = form.elements;
      const wd = form.querySelector('input[name="workout_done"]:checked')?.value;
      const row = {
        client_id: clientId, log_date: date,
        workout_done: wd == null ? (l.workout_done ?? false) : wd === 'true',
        steps: intOrNull(f.steps.value), water_ml: intOrNull(f.water_ml.value), sleep_hours: numOrNull(f.sleep_hours.value),
        notes: f.notes.value.trim() || null,
        custom_data: { ...(l.custom_data || {}) },
      };
      if (!foodEntries) {
        Object.assign(row, { calories: intOrNull(f.calories.value), protein_g: intOrNull(f.protein_g.value), carbs_g: intOrNull(f.carbs_g.value), fat_g: intOrNull(f.fat_g.value) });
      }
      for (const c of custom) {
        const v = f[`custom_${c.key}`]?.value?.trim();
        if (v) row.custom_data[c.key] = c.type === 'number' ? Number(v) : v; else delete row.custom_data[c.key];
      }
      const bad = [['steps', 0, 100000], ['water_ml', 0, 10000], ['sleep_hours', 0, 24], ['calories', 0, 10000], ['protein_g', 0, 600]]
        .find(([k, lo, hi]) => row[k] != null && (row[k] < lo || row[k] > hi));
      if (bad) throw new Error(`Check the ${bad[0].replace('_', ' ')} value.`);
      await q(supa.from('daily_logs').upsert(row, { onConflict: 'client_id,log_date' }));
      toast('Checklist saved');
      onSaved?.();
    },
  });
  document.querySelectorAll('[data-add-water]').forEach((b) => b.addEventListener('click', () => {
    const input = document.getElementById('ql-water');
    input.value = String((Number(input.value) || 0) + Number(b.dataset.addWater));
  }));
  void esc;
}
