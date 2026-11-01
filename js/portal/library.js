import { mountPortal } from '../lib/portal.js';
import { supa, q, signedUrl, signedUrls } from '../lib/supabase.js';
import { $$, html, raw, setHTML, fmtDate, fmtNum, label, safeUrl, toast } from '../lib/util.js';
import { icon } from '../lib/icons.js';

const ctx = await mountPortal({ active: 'library', title: 'Library' });
if (ctx) render(ctx).catch((err) => setHTML(ctx.content, html`<div class="notice danger">Could not load the library. ${err.message}</div>`));

async function render({ user, content }) {
  const [files, resources, favs] = await Promise.all([
    q(supa.from('client_files').select('*').eq('client_id', user.id).order('uploaded_at', { ascending: false })),
    q(supa.from('resources').select('*').eq('is_published', true).order('sort_order')),
    q(supa.from('favorites').select('*').eq('client_id', user.id)),
  ]);
  const fileUrls = await signedUrls('client-plans', files.map((f) => f.file_url));
  const resUrls = await signedUrls('resources', resources.filter((r) => r.file_path).map((r) => r.file_path));
  const favIds = (type) => favs.filter((f) => f.item_type === type).map((f) => f.item_id);
  const [favRecipes, favExercises] = await Promise.all([
    favIds('recipe').length ? q(supa.from('recipes').select('id,slug,title,calories,protein_g').in('id', favIds('recipe'))) : [],
    favIds('exercise').length ? q(supa.from('exercises').select('id,slug,name').in('id', favIds('exercise'))) : [],
  ]);
  const favRes = resources.filter((r) => favIds('resource').includes(r.id));
  const clientOnly = resources.filter((r) => r.access === 'clients');
  const publicRes = resources.filter((r) => r.access === 'public');
  const resLink = (r) => (r.file_path ? resUrls[r.file_path] : safeUrl(r.url)) || '#';
  const isFav = (r) => favIds('resource').includes(r.id);
  const resCard = (r) => html`<div class="card lib-card">
    <div class="cluster" style="justify-content:space-between"><span class="tag">${label('resourceCat', r.category)}</span>
      <button class="icon-btn fav" type="button" data-fav="${r.id}" aria-pressed="${isFav(r)}"><span class="sr-only">${isFav(r) ? 'Remove from saved' : 'Save'} ${r.title}</span>${raw(icon('star'))}</button></div>
    <h3 style="margin:0;font-size:1.1rem">${r.title}</h3>
    ${r.description ? html`<p class="muted small" style="margin:0">${r.description}</p>` : ''}
    <a class="btn btn-ghost btn-sm" href="${resLink(r)}" ${r.file_path || /^https?:/.test(r.url || '') ? raw('target="_blank" rel="noopener"') : ''} style="align-self:flex-start;margin-top:auto">${r.file_path ? 'Download' : 'Open'}</a></div>`;

  setHTML(content, html`
    <div class="page-intro"><div><h2>Library</h2><p>Files from your coach, client-only downloads, and everything you have saved.</p></div></div>
    <section class="panel"><div class="panel-head"><h3>From your coach</h3></div>
      ${files.length ? html`<div class="rows">${files.map((f) => html`<div class="row">${raw(icon('plan'))}<div class="grow"><b>${f.title}</b><span>${f.description ? `${f.description} · ` : ''}${fmtDate(f.uploaded_at)}</span></div>
        ${fileUrls[f.file_url] ? html`<a class="btn btn-primary btn-sm" href="${fileUrls[f.file_url]}" target="_blank" rel="noopener">Download</a>` : html`<span class="small muted">Unavailable</span>`}</div>`)}</div>`
    : html`<p class="muted small">Plans, meal guides and other files your coach shares with you appear here.</p>`}
    </section>
    ${clientOnly.length ? html`<section style="margin-top:24px"><h3 style="font-size:1.125rem">Client downloads</h3><div class="lib-grid">${clientOnly.map(resCard)}</div></section>` : ''}
    <section style="margin-top:24px"><h3 style="font-size:1.125rem">Saved</h3>
      ${favRecipes.length || favRes.length || favExercises.length ? html`<div class="rows">
        ${favRecipes.map((r) => html`<a class="row" href="/nutrition/recipes/${r.slug}" style="text-decoration:none"><div class="grow"><b>${r.title}</b><span>Recipe · ${fmtNum(r.calories)} kcal · ${fmtNum(r.protein_g)} g protein</span></div></a>`)}
        ${favExercises.map((x) => html`<a class="row" href="/workouts#${x.slug}" style="text-decoration:none"><div class="grow"><b>${x.name}</b><span>Exercise</span></div></a>`)}
        ${favRes.map((r) => html`<a class="row" href="${resLink(r)}" style="text-decoration:none"><div class="grow"><b>${r.title}</b><span>Guide</span></div></a>`)}
      </div>` : html`<p class="muted small">Tap <b>Save to favourites</b> on any <a href="/nutrition">recipe</a>, or the star on a guide below.</p>`}
    </section>
    <section style="margin-top:24px"><h3 style="font-size:1.125rem">Guides</h3><div class="lib-grid">${publicRes.map(resCard)}</div></section>`);

  $$('[data-fav]').forEach((b) => b.addEventListener('click', async () => {
    const on = b.getAttribute('aria-pressed') === 'true';
    const id = b.dataset.fav;
    const { error } = on
      ? await supa.from('favorites').delete().eq('item_type', 'resource').eq('item_id', id)
      : await supa.from('favorites').insert({ item_type: 'resource', item_id: id });
    if (error) { toast(error.message, 'error'); return; }
    toast(on ? 'Removed from saved' : 'Saved');
    render({ user, content });
  }));
}
void signedUrl;
