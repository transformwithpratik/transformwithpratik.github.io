import { route, go, refreshCounts, statusTag, q, supa } from './shell.js';
import { $, $$, html, raw, setHTML, fmtNum, fmtDate, timeAgo, label, LABELS, toast, confirmDialog, busy, numOrNull, intOrNull, slugify, safeUrl } from '../lib/util.js';
import { openModal } from '../lib/portal.js';
import { publicFileUrl } from '../lib/rest.js';
import { signedUrl } from '../lib/supabase.js';
import { recipeArt } from '../lib/render.js';

async function uploadPublic(bucket, file, prefix) {
  if (!file) return null;
  if (file.size > 5e6) throw new Error('Image must be under 5 MB. Export a smaller JPG or WebP.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supa.storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return path;
}
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const checks = (name, options, selected) => html`<div class="choices">${Object.entries(options).map(([k, v]) => html`<label class="choice"><input type="checkbox" name="${name}" value="${k}" ${selected.includes(k) ? raw('checked') : ''}><span>${v}</span></label>`)}</div>`;
const checked = (form, name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);

// ------------------------------------------------------------------ Recipes
route('recipes', async (view) => {
  const rows = await q(supa.from('recipes').select('*').order('sort_order').order('title'));
  setHTML(view, html`
    <div class="page-intro"><div><h2>Recipes</h2><p>${rows.filter((r) => r.is_published).length} published in the Nutrition Hub.</p></div><button class="btn btn-primary btn-sm" type="button" data-new>New recipe</button></div>
    <div class="notice" style="margin-bottom:16px"><span>New and edited recipes show on the site straight away. Search engines see new recipes after the next site rebuild (<code>node scripts/build-recipe-pages.mjs</code>).</span></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Recipe</th><th class="num">kcal</th><th class="num">Protein</th><th>Categories</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows.map((r) => html`<tr><td><b>${r.title}</b><div class="small muted">/nutrition/recipes/${r.slug}</div></td><td class="num">${fmtNum(r.calories)}</td><td class="num">${fmtNum(r.protein_g)} g</td><td class="small">${r.categories.map((c) => label('category', c)).join(', ')}</td><td>${statusTag(r.is_published ? 'published' : 'draft', r.is_published ? 'Published' : 'Hidden')}</td><td><button class="btn btn-quiet btn-sm" type="button" data-edit="${r.id}">Edit</button></td></tr>`)}</tbody></table></div>`);
  $('[data-new]').addEventListener('click', () => recipeModal({}));
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => recipeModal(rows.find((r) => r.id === b.dataset.edit))));
});

function recipeModal(r) {
  const isEdit = !!r.id;
  openModal({
    title: isEdit ? `Edit ${r.title}` : 'New recipe', wide: true, danger: isEdit ? 'Delete' : null,
    body: html`
      <div class="form-row"><div class="field"><label for="r-t">Title</label><input class="input" id="r-t" name="title" value="${r.title || ''}" required maxlength="120"></div>
        <div class="field"><label for="r-s">URL slug</label><input class="input" id="r-s" name="slug" value="${r.slug || ''}" placeholder="auto from title" pattern="[a-z0-9-]+"></div></div>
      <div class="field"><label for="r-sum">Summary</label><textarea class="input" id="r-sum" name="summary" maxlength="500" style="min-height:70px">${r.summary || ''}</textarea></div>
      <div class="form-row">
        ${[['servings', 'Servings', 1], ['prep_minutes', 'Prep (min)', 0], ['cook_minutes', 'Cook (min)', 0], ['calories', 'kcal / serving', 0], ['protein_g', 'Protein g', 0], ['carbs_g', 'Carbs g', 0], ['fat_g', 'Fat g', 0], ['fiber_g', 'Fibre g', 0]].map(([k, l, min]) => html`<div class="field"><label for="r-${k}">${l}</label><input class="input" id="r-${k}" name="${k}" type="number" step="any" min="${min}" value="${r[k] ?? (k === 'servings' ? 1 : '')}"></div>`)}
      </div>
      <div class="field"><label for="r-ing">Ingredients, one per line</label><textarea class="input" id="r-ing" name="ingredients" style="min-height:140px">${(r.ingredients || []).map((i) => i.item).join('\n')}</textarea></div>
      <div class="field"><label for="r-steps">Method, one step per line</label><textarea class="input" id="r-steps" name="steps" style="min-height:140px">${(r.steps || []).join('\n')}</textarea></div>
      <div class="field"><label for="r-tips">Tip</label><input class="input" id="r-tips" name="tips" value="${r.tips || ''}" maxlength="2000"></div>
      <fieldset><legend>Categories</legend>${checks('categories', LABELS.category, r.categories || [])}</fieldset>
      <fieldset><legend>Diet tags</legend>${checks('diet_tags', { vegetarian: 'Vegetarian', eggetarian: 'Eggetarian', vegan: 'Vegan', jain: 'Jain', gluten_free: 'Gluten-free' }, r.diet_tags || [])}</fieldset>
      <div class="field"><label for="r-img">Photo ${r.image_url ? '(replace)' : '(optional; a generated graphic is used without one)'}</label><input class="input" id="r-img" name="image" type="file" accept="image/jpeg,image/png,image/webp"></div>
      <div class="form-row"><label class="check"><input type="checkbox" name="is_published" ${r.is_published !== false ? raw('checked') : ''}> Published</label>
        <div class="field"><label for="r-so">Sort order</label><input class="input" id="r-so" name="sort_order" type="number" value="${r.sort_order ?? 100}"></div></div>
      <p class="hint">Work out macros from weighed ingredients and standard food tables. Visitors see "estimate" next to the numbers.</p>`,
    onSubmit: async (f) => {
      const e = f.elements;
      const row = {
        title: e.title.value.trim(), slug: (e.slug.value.trim() || slugify(e.title.value)), summary: e.summary.value.trim() || null,
        servings: intOrNull(e.servings.value) || 1, prep_minutes: intOrNull(e.prep_minutes.value), cook_minutes: intOrNull(e.cook_minutes.value),
        calories: intOrNull(e.calories.value), protein_g: numOrNull(e.protein_g.value), carbs_g: numOrNull(e.carbs_g.value), fat_g: numOrNull(e.fat_g.value), fiber_g: numOrNull(e.fiber_g.value),
        ingredients: lines(e.ingredients.value).map((item) => ({ item, grams: null })), steps: lines(e.steps.value), tips: e.tips.value.trim() || null,
        categories: checked(f, 'categories'), diet_tags: checked(f, 'diet_tags'), is_published: e.is_published.checked, sort_order: intOrNull(e.sort_order.value) ?? 100,
      };
      if (!row.title || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug)) throw new Error('Add a title (and a slug of lowercase letters, numbers and dashes).');
      if (!row.ingredients.length || !row.steps.length) throw new Error('Add ingredients and method steps.');
      if (row.calories == null || row.protein_g == null) throw new Error('Add calories and protein per serving.');
      const img = await uploadPublic('site-media', e.image.files[0], 'recipes');
      if (img) row.image_url = img;
      if (isEdit) await q(supa.from('recipes').update(row).eq('id', r.id)); else await q(supa.from('recipes').insert(row));
      toast('Recipe saved'); go('recipes');
    },
  });
  $('[data-danger]')?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: `Delete ${r.title}?`, body: 'It is removed from the site. To hide it temporarily, untick Published instead.' }))) return;
    await q(supa.from('recipes').delete().eq('id', r.id)); document.querySelector('dialog.modal')?.remove(); toast('Deleted'); go('recipes');
  });
  void recipeArt;
}

// ---------------------------------------------------------------- Exercises
route('exercises', async (view) => {
  const rows = await q(supa.from('exercises').select('*').order('muscle_group').order('name'));
  setHTML(view, html`
    <div class="page-intro"><div><h2>Exercise library</h2><p>${rows.length} exercises. ${rows.filter((x) => x.video_url).length} have demo videos.</p></div><button class="btn btn-primary btn-sm" type="button" data-new>New exercise</button></div>
    <div class="notice" style="margin-bottom:16px"><span>Add a YouTube link (your own demo, unlisted is fine) to show the video in the public library and in client plans.</span></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Exercise</th><th>Muscle</th><th>Equipment</th><th>Video</th><th></th></tr></thead>
    <tbody>${rows.map((x) => html`<tr><td><b>${x.name}</b></td><td>${label('muscle', x.muscle_group)}</td><td>${label('equipment', x.equipment)}</td><td>${x.video_url ? 'Yes' : html`<span class="muted">None</span>`}</td><td><button class="btn btn-quiet btn-sm" type="button" data-edit="${x.id}">Edit</button></td></tr>`)}</tbody></table></div>`);
  $('[data-new]').addEventListener('click', () => exerciseModal({}));
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => exerciseModal(rows.find((r) => r.id === b.dataset.edit))));
});

function exerciseModal(x) {
  const isEdit = !!x.id;
  const sel = (name, opts, cur) => html`<select class="input" name="${name}" id="x-${name}">${Object.entries(opts).map(([k, v]) => html`<option value="${k}" ${k === cur ? raw('selected') : ''}>${v}</option>`)}</select>`;
  openModal({
    title: isEdit ? `Edit ${x.name}` : 'New exercise', wide: true, danger: isEdit ? 'Delete' : null,
    body: html`<div class="form-row"><div class="field"><label for="x-n">Name</label><input class="input" id="x-n" name="name" value="${x.name || ''}" required maxlength="80"></div>
        <div class="field"><label for="x-video_url">Demo video URL</label><input class="input" id="x-video_url" name="video_url" type="url" value="${x.video_url || ''}" placeholder="https://youtu.be/..."></div></div>
      <div class="form-row"><div class="field"><label for="x-muscle_group">Muscle group</label>${sel('muscle_group', LABELS.muscle, x.muscle_group || 'legs')}</div>
        <div class="field"><label for="x-equipment">Equipment</label>${sel('equipment', LABELS.equipment, x.equipment || 'bodyweight')}</div>
        <div class="field"><label for="x-level">Level</label>${sel('level', LABELS.experience, x.level || 'beginner')}</div></div>
      <div class="field"><label for="x-s">Summary</label><input class="input" id="x-s" name="summary" value="${x.summary || ''}" maxlength="300"></div>
      <div class="field"><label for="x-st">Steps, one per line</label><textarea class="input" id="x-st" name="steps">${(x.steps || []).join('\n')}</textarea></div>
      <div class="form-row"><div class="field"><label for="x-c">Cues, one per line</label><textarea class="input" id="x-c" name="cues">${(x.cues || []).join('\n')}</textarea></div>
        <div class="field"><label for="x-m">Common mistakes, one per line</label><textarea class="input" id="x-m" name="mistakes">${(x.mistakes || []).join('\n')}</textarea></div></div>
      <div class="field"><label for="x-sub">Substitutions, comma separated</label><input class="input" id="x-sub" name="substitutions" value="${(x.substitutions || []).join(', ')}"></div>
      <label class="check"><input type="checkbox" name="is_published" ${x.is_published !== false ? raw('checked') : ''}> Published</label>`,
    onSubmit: async (f) => {
      const e = f.elements;
      const row = { name: e.name.value.trim(), slug: x.slug || slugify(e.name.value), video_url: e.video_url.value.trim() || null, muscle_group: e.muscle_group.value, equipment: e.equipment.value, level: e.level.value, summary: e.summary.value.trim() || null, steps: lines(e.steps.value), cues: lines(e.cues.value), mistakes: lines(e.mistakes.value), substitutions: e.substitutions.value.split(',').map((s) => s.trim()).filter(Boolean), is_published: e.is_published.checked };
      if (!row.name) throw new Error('Add a name.');
      if (row.video_url && !/^https:\/\//.test(row.video_url)) throw new Error('Video link must start with https://');
      if (isEdit) await q(supa.from('exercises').update(row).eq('id', x.id)); else await q(supa.from('exercises').insert(row));
      toast('Saved'); go('exercises');
    },
  });
  $('[data-danger]')?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: `Delete ${x.name}?`, body: 'It is removed from the library. Client plans that mention it keep the name.' }))) return;
    await q(supa.from('exercises').delete().eq('id', x.id)); document.querySelector('dialog.modal')?.remove(); go('exercises');
  });
}

// ---------------------------------------------------------------- Resources
route('resources', async (view) => {
  const rows = await q(supa.from('resources').select('*').order('sort_order'));
  setHTML(view, html`
    <div class="page-intro"><div><h2>Resources and PDFs</h2><p>Public guides and client-only downloads.</p></div><button class="btn btn-primary btn-sm" type="button" data-new>Add resource</button></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Title</th><th>Category</th><th>Who can see it</th><th>Type</th><th></th></tr></thead>
    <tbody>${rows.map((r) => html`<tr><td><b>${r.title}</b><div class="small muted">${r.url || r.file_path}</div></td><td>${label('resourceCat', r.category)}</td><td>${r.access === 'clients' ? 'Active clients' : 'Everyone'}${r.is_published ? '' : ' (hidden)'}</td><td>${r.file_path ? 'File' : 'Link'}</td><td><button class="btn btn-quiet btn-sm" type="button" data-edit="${r.id}">Edit</button></td></tr>`)}</tbody></table></div>`);
  $('[data-new]').addEventListener('click', () => resourceModal({}));
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => resourceModal(rows.find((r) => r.id === b.dataset.edit))));
});

async function resourceModal(r) {
  const isEdit = !!r.id;
  const fileLink = r.file_path ? await signedUrl('resources', r.file_path) : '';
  openModal({
    title: isEdit ? `Edit ${r.title}` : 'Add resource', danger: isEdit ? 'Delete' : null,
    body: html`<div class="field"><label for="rs-t">Title</label><input class="input" id="rs-t" name="title" value="${r.title || ''}" required maxlength="120"></div>
      <div class="field"><label for="rs-d">Description</label><input class="input" id="rs-d" name="description" value="${r.description || ''}" maxlength="500"></div>
      <div class="form-row"><div class="field"><label for="rs-c">Category</label><select class="input" id="rs-c" name="category">${Object.entries(LABELS.resourceCat).map(([k, v]) => html`<option value="${k}" ${k === r.category ? raw('selected') : ''}>${v}</option>`)}</select></div>
        <div class="field"><label for="rs-a">Who can see it</label><select class="input" id="rs-a" name="access"><option value="public" ${r.access !== 'clients' ? raw('selected') : ''}>Everyone</option><option value="clients" ${r.access === 'clients' ? raw('selected') : ''}>Active clients only</option></select></div></div>
      <div class="field"><label for="rs-u">Link (a page on the site or an external URL)</label><input class="input" id="rs-u" name="url" value="${r.url || ''}" placeholder="/library/... or https://..."></div>
      <div class="field"><label for="rs-f">Or upload a file (PDF, up to 25 MB) ${fileLink ? html`<a class="small" href="${fileLink}" target="_blank">current file</a>` : ''}</label><input class="input" id="rs-f" name="file" type="file" accept="application/pdf,image/*"><p class="hint">Uploaded files are private and served with expiring links, even for public resources.</p></div>
      <div class="form-row"><label class="check"><input type="checkbox" name="is_published" ${r.is_published !== false ? raw('checked') : ''}> Published</label>
        <div class="field"><label for="rs-o">Sort order</label><input class="input" id="rs-o" name="sort_order" type="number" value="${r.sort_order ?? 100}"></div></div>`,
    onSubmit: async (f) => {
      const e = f.elements;
      const row = { title: e.title.value.trim(), slug: r.slug || slugify(e.title.value), description: e.description.value.trim() || null, category: e.category.value, access: e.access.value, url: e.url.value.trim() || null, is_published: e.is_published.checked, sort_order: intOrNull(e.sort_order.value) ?? 100 };
      if (!row.title) throw new Error('Add a title.');
      if (row.url && !safeUrl(row.url)) throw new Error('Links must start with / or https://');
      const file = e.file.files[0];
      if (file) {
        if (file.size > 25e6) throw new Error('File must be under 25 MB.');
        const path = `${row.slug}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '-').slice(-60)}`;
        const { error } = await supa.storage.from('resources').upload(path, file, { contentType: file.type });
        if (error) throw new Error(error.message);
        row.file_path = path; row.kind = 'pdf';
      } else row.file_path = r.file_path || null;
      if (!row.url && !row.file_path) throw new Error('Add a link or upload a file.');
      if (isEdit) await q(supa.from('resources').update(row).eq('id', r.id)); else await q(supa.from('resources').insert(row));
      toast('Saved'); go('resources');
    },
  });
  $('[data-danger]')?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: `Delete ${r.title}?`, body: 'The resource and any uploaded file are removed.' }))) return;
    if (r.file_path) await supa.storage.from('resources').remove([r.file_path]);
    await q(supa.from('resources').delete().eq('id', r.id)); document.querySelector('dialog.modal')?.remove(); go('resources');
  });
}

// ---------------------------------------------------------- Transformations
route('transformations', async (view) => {
  const rows = await q(supa.from('transformations').select('*').order('sort_order').order('created_at', { ascending: false }));
  setHTML(view, html`
    <div class="page-intro"><div><h2>Transformations</h2><p>Only stories with written client consent can be published.</p></div><button class="btn btn-primary btn-sm" type="button" data-new>Add transformation</button></div>
    ${rows.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Goal</th><th>Weeks</th><th>Consent</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows.map((t) => html`<tr><td><b>${t.client_display_name}</b><div class="small muted">${t.headline || ''}</div></td><td>${label('tf', t.goal_category)}</td><td>${t.duration_weeks || '-'}</td><td>${t.consent_confirmed ? 'Confirmed' : html`<span class="tag tag-warn">Missing</span>`}</td><td>${statusTag(t.status, t.status)}</td><td><button class="btn btn-quiet btn-sm" type="button" data-edit="${t.id}">Edit</button></td></tr>`)}</tbody></table></div>`
    : html`<div class="empty"><h3>No transformations yet</h3><p>When a client agrees in writing to share their results, add their before and after photos and story here. The public gallery shows only published stories.</p></div>`}`);
  $('[data-new]').addEventListener('click', () => tfModal({}));
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => tfModal(rows.find((r) => r.id === b.dataset.edit))));
});

async function tfModal(t) {
  const isEdit = !!t.id;
  const clients = await q(supa.from('profiles').select('id,full_name').eq('role', 'client').order('full_name'));
  openModal({
    title: isEdit ? `Edit ${t.client_display_name}` : 'Add transformation', wide: true, danger: isEdit ? 'Delete' : null,
    body: html`<div class="form-row"><div class="field"><label for="tf-n">Display name</label><input class="input" id="tf-n" name="client_display_name" value="${t.client_display_name || ''}" required maxlength="60" placeholder="e.g. Rahul S."></div>
        <div class="field"><label for="tf-c">Linked client (optional)</label><select class="input" id="tf-c" name="client_id"><option value="">None</option>${clients.map((c) => html`<option value="${c.id}" ${c.id === t.client_id ? raw('selected') : ''}>${c.full_name || c.id.slice(0, 8)}</option>`)}</select></div></div>
      <div class="field"><label for="tf-h">Headline</label><input class="input" id="tf-h" name="headline" value="${t.headline || ''}" maxlength="120" placeholder="e.g. 9 kg down in 16 weeks while working night shifts"></div>
      <div class="form-row"><div class="field"><label for="tf-g">Category</label><select class="input" id="tf-g" name="goal_category">${Object.entries(LABELS.tf).map(([k, v]) => html`<option value="${k}" ${k === t.goal_category ? raw('selected') : ''}>${v}</option>`)}</select></div>
        <div class="field"><label for="tf-w">Weeks</label><input class="input" id="tf-w" name="duration_weeks" type="number" min="1" max="260" value="${t.duration_weeks ?? ''}"></div>
        <div class="field"><label for="tf-sw">Start kg</label><input class="input" id="tf-sw" name="start_weight_kg" type="number" step="0.1" value="${t.start_weight_kg ?? ''}"></div>
        <div class="field"><label for="tf-ew">End kg</label><input class="input" id="tf-ew" name="end_weight_kg" type="number" step="0.1" value="${t.end_weight_kg ?? ''}"></div></div>
      <div class="field"><label for="tf-goal">Client's goal</label><input class="input" id="tf-goal" name="goal" value="${t.goal || ''}" maxlength="300"></div>
      <div class="field"><label for="tf-s">What we did (achievement summary)</label><textarea class="input" id="tf-s" name="summary" maxlength="3000">${t.summary || ''}</textarea></div>
      <div class="field"><label for="tf-q">Client testimonial, in their words</label><textarea class="input" id="tf-q" name="testimonial" maxlength="2000">${t.testimonial || ''}</textarea></div>
      <div class="form-row"><div class="field"><label for="tf-b">Before photo ${t.before_image_url ? html`<a class="small" href="${publicFileUrl('transformations', t.before_image_url)}" target="_blank">(current)</a>` : ''}</label><input class="input" id="tf-b" name="before" type="file" accept="image/jpeg,image/png,image/webp"></div>
        <div class="field"><label for="tf-a">After photo ${t.after_image_url ? html`<a class="small" href="${publicFileUrl('transformations', t.after_image_url)}" target="_blank">(current)</a>` : ''}</label><input class="input" id="tf-a" name="after" type="file" accept="image/jpeg,image/png,image/webp"></div></div>
      <label class="check"><input type="checkbox" name="consent_confirmed" ${t.consent_confirmed ? raw('checked') : ''}> <span>I have the client's written consent to publish these photos, numbers and words.</span></label>
      <div class="field"><label for="tf-cn">Where the consent is recorded</label><input class="input" id="tf-cn" name="consent_note" value="${t.consent_note || ''}" placeholder="e.g. WhatsApp message, 3 Oct 2026"></div>
      <div class="form-row"><div class="field"><label for="tf-st">Status</label><select class="input" id="tf-st" name="status">${['draft', 'published', 'archived'].map((s) => html`<option value="${s}" ${s === (t.status || 'draft') ? raw('selected') : ''}>${s}</option>`)}</select></div>
        <div class="field"><label for="tf-o">Sort order</label><input class="input" id="tf-o" name="sort_order" type="number" value="${t.sort_order ?? 0}"></div></div>
      <p class="hint">Photos uploaded here are public once published. Crop out faces or anything the client asked to hide before uploading.</p>`,
    onSubmit: async (f) => {
      const e = f.elements;
      const row = { client_display_name: e.client_display_name.value.trim(), client_id: e.client_id.value || null, headline: e.headline.value.trim() || null, goal_category: e.goal_category.value, duration_weeks: intOrNull(e.duration_weeks.value), start_weight_kg: numOrNull(e.start_weight_kg.value), end_weight_kg: numOrNull(e.end_weight_kg.value), goal: e.goal.value.trim() || null, summary: e.summary.value.trim() || null, testimonial: e.testimonial.value.trim() || null, consent_confirmed: e.consent_confirmed.checked, consent_note: e.consent_note.value.trim() || null, status: e.status.value, sort_order: intOrNull(e.sort_order.value) ?? 0 };
      if (!row.client_display_name) throw new Error('Add a display name.');
      if (row.status === 'published' && !row.consent_confirmed) throw new Error('Confirm written consent before publishing.');
      row.slug = t.slug || `${slugify(row.client_display_name)}-${Date.now().toString(36).slice(-4)}`;
      const b = await uploadPublic('transformations', e.before.files[0], row.slug); if (b) row.before_image_url = b;
      const a = await uploadPublic('transformations', e.after.files[0], row.slug); if (a) row.after_image_url = a;
      if (isEdit) await q(supa.from('transformations').update(row).eq('id', t.id)); else await q(supa.from('transformations').insert(row));
      toast(row.status === 'published' ? 'Published' : 'Saved'); go('transformations');
    },
  });
  $('[data-danger]')?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete this transformation?', body: 'The story and its photos are removed from the site.' }))) return;
    const paths = [t.before_image_url, t.after_image_url].filter((p) => p && !/^https?:/.test(p));
    if (paths.length) await supa.storage.from('transformations').remove(paths);
    await q(supa.from('transformations').delete().eq('id', t.id)); document.querySelector('dialog.modal')?.remove(); go('transformations');
  });
}

// ------------------------------------------------------------------ Reviews
route('reviews', async (view, which = 'pending') => {
  const rows = await q(supa.from('feedback').select('*').order('created_at', { ascending: false }).limit(300));
  const list = rows.filter((r) => (which === 'all' ? true : r.status === which));
  setHTML(view, html`
    <div class="page-intro"><div><h2>Reviews and feedback</h2><p>Nothing is public until you approve it, and only when the person agreed to share it.</p></div>
      <div class="cluster">${['pending', 'approved', 'rejected', 'all'].map((s) => html`<a class="btn btn-sm ${which === s ? 'btn-primary' : 'btn-quiet'}" href="#reviews/${s}">${s[0].toUpperCase() + s.slice(1)} (${s === 'all' ? rows.length : rows.filter((r) => r.status === s).length})</a>`)}</div></div>
    ${list.length ? html`<div class="stack" style="--stack:12px">${list.map((r) => html`<section class="panel">
      <div class="panel-head"><h3>${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))} <span class="small muted" style="font-weight:500">${r.is_anonymous ? 'Anonymous' : r.name || 'No name'}${r.relationship ? ` · ${label('relationship', r.relationship)}` : ''} · ${timeAgo(r.created_at)}</span></h3>
        ${statusTag(r.status, r.status)}</div>
      <p class="pre-wrap">${r.feedback}</p>
      <p class="small muted">${r.consent_public ? 'Agreed to be published.' : 'Did not agree to publication: private feedback only.'}${r.email ? html` · <a href="mailto:${r.email}">${r.email}</a>` : ''}</p>
      <div class="cluster">
        ${r.consent_public ? html`<input class="input" data-dn="${r.id}" value="${r.display_name || ''}" placeholder="Display name, e.g. Neha K." style="width:auto;min-height:38px" aria-label="Display name">` : ''}
        ${r.status !== 'approved' && r.consent_public ? html`<button class="btn btn-primary btn-sm" type="button" data-approve="${r.id}">Approve and publish</button>` : ''}
        ${r.status === 'approved' ? html`<button class="btn btn-ghost btn-sm" type="button" data-feature="${r.id}">${r.featured ? 'Unfeature' : 'Feature on homepage'}</button>` : ''}
        ${r.status !== 'rejected' ? html`<button class="btn btn-quiet btn-sm" type="button" data-reject="${r.id}">${r.consent_public ? 'Reject' : 'Mark handled'}</button>` : ''}
        <button class="btn btn-quiet btn-sm" type="button" data-del="${r.id}">Delete</button></div></section>`)}</div>`
    : html`<div class="empty"><h3>Nothing here</h3><p>Feedback submitted at /feedback appears here for review.</p></div>`}`);
  const upd = async (id, patch, msg) => { try { await q(supa.from('feedback').update(patch).eq('id', id)); toast(msg); refreshCounts(); go(`reviews/${which}`); } catch (err) { toast(err.message, 'error'); } };
  $$('[data-approve]').forEach((b) => b.addEventListener('click', () => upd(b.dataset.approve, { status: 'approved', display_name: $(`[data-dn="${b.dataset.approve}"]`)?.value.trim() || null }, 'Published')));
  $$('[data-reject]').forEach((b) => b.addEventListener('click', () => upd(b.dataset.reject, { status: 'rejected', featured: false }, 'Done')));
  $$('[data-feature]').forEach((b) => b.addEventListener('click', () => { const r = rows.find((x) => x.id === b.dataset.feature); upd(r.id, { featured: !r.featured }, r.featured ? 'Unfeatured' : 'Featured'); }));
  $$('[data-del]').forEach((b) => b.addEventListener('click', async () => { if (await confirmDialog({ title: 'Delete this feedback?', body: 'It is permanently removed.' })) { await supa.from('feedback').delete().eq('id', b.dataset.del); refreshCounts(); go(`reviews/${which}`); } }));
  void fmtDate; void busy;
});
