import { $, $$, html, setHTML, debounce, LABELS } from '../lib/util.js';
import { initSite } from '../lib/site.js';
import { select } from '../lib/rest.js';
import { recipeCard } from '../lib/render.js';
import { AUTH_STORAGE_KEY } from '../config.js';

initSite();
const params = new URLSearchParams(location.search);
const state = { q: params.get('q') || '', cat: params.get('cat') || '', diet: params.get('diet') || '', sort: params.get('sort') || '', favs: false };
let recipes = [];
let favIds = new Set();

setHTML($('[data-cats]'), [html`<button class="chip" type="button" data-cat="" aria-pressed="true">All</button>`,
  ...Object.entries(LABELS.category).map(([k, v]) => html`<button class="chip" type="button" data-cat="${k}" aria-pressed="false">${v}</button>`)]);
$('[data-q]').value = state.q;
$('[data-diet]').value = state.diet;
$('[data-sort]').value = state.sort;

function syncUrl() {
  const u = new URL(location.href);
  for (const k of ['q', 'cat', 'diet', 'sort']) { if (state[k]) u.searchParams.set(k, state[k]); else u.searchParams.delete(k); }
  history.replaceState(null, '', u);
}

function render() {
  $$('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat)));
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  let list = recipes.filter((r) => {
    if (state.cat && !r.categories.includes(state.cat)) return false;
    if (state.diet && !r.diet_tags.includes(state.diet)) return false;
    if (state.favs && !favIds.has(r.id)) return false;
    if (!words.length) return true;
    const hay = `${r.title} ${r.summary} ${(r.ingredients || []).map((i) => i.item).join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const sorters = {
    protein: (a, b) => b.protein_g - a.protein_g,
    density: (a, b) => b.protein_g / b.calories - a.protein_g / a.calories,
    calories: (a, b) => a.calories - b.calories,
    time: (a, b) => (a.prep_minutes + a.cook_minutes) - (b.prep_minutes + b.cook_minutes),
  };
  if (sorters[state.sort]) list = [...list].sort(sorters[state.sort]);
  $('[data-count]').textContent = `Showing ${list.length} of ${recipes.length} recipes`;
  setHTML($('[data-recipes]'), list.length ? list.map(recipeCard)
    : html`<div class="empty" style="grid-column:1/-1"><h3>No recipes match</h3><p>Try fewer words or clear a filter.</p><p><button class="btn btn-ghost btn-sm" type="button" data-reset>Clear filters</button></p></div>`);
  $('[data-reset]')?.addEventListener('click', () => {
    Object.assign(state, { q: '', cat: '', diet: '', sort: '', favs: false });
    $('[data-q]').value = ''; $('[data-diet]').value = ''; $('[data-sort]').value = '';
    $('[data-favs]').setAttribute('aria-pressed', 'false');
    syncUrl(); render();
  });
}

$('[data-cats]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  state.cat = b.dataset.cat; syncUrl(); render();
});
$('[data-q]').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); syncUrl(); render(); }, 200));
$('[data-diet]').addEventListener('change', (e) => { state.diet = e.target.value; syncUrl(); render(); });
$('[data-sort]').addEventListener('change', (e) => { state.sort = e.target.value; syncUrl(); render(); });
$('[data-favs]').addEventListener('click', (e) => {
  state.favs = !state.favs; e.currentTarget.setAttribute('aria-pressed', String(state.favs)); render();
});

try {
  recipes = await select('recipes', 'select=id,slug,title,summary,image_url,calories,protein_g,carbs_g,fat_g,prep_minutes,cook_minutes,categories,diet_tags,ingredients&is_published=eq.true&order=sort_order.asc,title.asc');
  render();
} catch (err) {
  setHTML($('[data-recipes]'), html`<div class="notice danger" style="grid-column:1/-1">Could not load recipes. ${err.message}</div>`);
}

// Signed-in clients can filter to their saved recipes.
let hasSession = false;
try { hasSession = !!JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null')?.access_token; } catch { /* ignore */ }
if (hasSession) {
  const { supa } = await import('../lib/supabase.js');
  const { data } = await supa.from('favorites').select('item_id').eq('item_type', 'recipe');
  if (data?.length) { favIds = new Set(data.map((f) => f.item_id)); $('[data-favs]').hidden = false; }
}
