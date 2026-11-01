import { $, html, setHTML, toast } from '../lib/util.js';
import { initSite } from '../lib/site.js';
import { select } from '../lib/rest.js';
import { recipeDetail, recipeJsonLd } from '../lib/render.js';
import { setPageMeta, slugFromLocation } from '../lib/seo.js';
import { AUTH_STORAGE_KEY } from '../config.js';

initSite();
const box = $('[data-recipe]');
const slug = slugFromLocation('recipes') || box.dataset.slug;
let recipe = null;

async function load() {
  if (!slug) { notFound(); return; }
  try {
    const rows = await select('recipes', `select=*&is_published=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    recipe = rows?.[0];
    if (!recipe) { if (!box.dataset.prerendered) notFound(); return; }
    const cat = recipe.categories?.[0];
    const related = cat ? (await select('recipes', `select=id,slug,title,calories,protein_g,prep_minutes,cook_minutes,diet_tags,image_url&is_published=eq.true&categories=cs.{${cat}}&slug=neq.${encodeURIComponent(slug)}&limit=3`)) : [];
    setHTML(box, recipeDetail(recipe, related || []));
    if (!box.dataset.prerendered) {
      setPageMeta({ title: `${recipe.title}: ${Math.round(recipe.protein_g)} g protein recipe | GetFitWithPratik`, description: recipe.summary, path: `/nutrition/recipe/?slug=${encodeURIComponent(recipe.slug)}`, jsonLd: recipeJsonLd(recipe) });
    }
  } catch (err) {
    if (!box.dataset.prerendered) setHTML(box, html`<div class="notice danger">Could not load this recipe. ${err.message}</div>`);
  }
  wire();
}

function notFound() {
  setHTML(box, html`<p class="crumbs"><a href="/nutrition">Nutrition hub</a></p><div class="empty"><h1>Recipe not found</h1><p>It may have been renamed or removed. <a href="/nutrition#recipes">Browse all recipes</a>.</p></div>`);
}

async function wire() {
  $('[data-print]')?.addEventListener('click', () => window.print());
  $('[data-share]')?.addEventListener('click', async () => {
    const url = location.origin + `/nutrition/recipes/${slug}`;
    if (navigator.share) { try { await navigator.share({ title: document.title, url }); } catch { /* cancelled */ } return; }
    try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast(url); }
  });
  const fav = $('[data-fav]');
  if (!fav) return;
  let session = false;
  try { session = !!JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null')?.access_token; } catch { /* ignore */ }
  if (!session) {
    fav.addEventListener('click', () => { location.href = `/portal/login?next=${encodeURIComponent(location.pathname)}`; });
    fav.textContent = 'Log in to save';
    return;
  }
  const { supa } = await import('../lib/supabase.js');
  const id = recipe?.id;
  if (!id) { fav.hidden = true; return; }
  const { data } = await supa.from('favorites').select('item_id').eq('item_type', 'recipe').eq('item_id', id).maybeSingle();
  const set = (on) => { fav.setAttribute('aria-pressed', String(on)); fav.textContent = on ? 'Saved to favourites' : 'Save to favourites'; };
  set(!!data);
  fav.addEventListener('click', async () => {
    const on = fav.getAttribute('aria-pressed') === 'true';
    const { error } = on
      ? await supa.from('favorites').delete().eq('item_type', 'recipe').eq('item_id', id)
      : await supa.from('favorites').insert({ item_type: 'recipe', item_id: id });
    if (error) { toast(error.message, 'error'); return; }
    set(!on);
    toast(on ? 'Removed from favourites' : 'Saved. Find it under Library in your portal.');
  });
}

load();
