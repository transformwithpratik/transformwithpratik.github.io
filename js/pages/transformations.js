import { $, $$, html, setHTML } from '../lib/util.js';
import { initSite } from '../lib/site.js';
import { select } from '../lib/rest.js';
import { transformationCard } from '../lib/render.js';

initSite();
const list = $('[data-list]');
let items = [];
let cat = new URLSearchParams(location.search).get('goal') || '';

function render() {
  const shown = cat ? items.filter((t) => t.goal_category === cat) : items;
  $$('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
  if (!items.length) {
    setHTML(list, html`<div class="empty" style="grid-column:1/-1"><h3>Client stories are on their way</h3><p>Stories appear here only after a client agrees in writing to share their photos and results. In the meantime, try the <a href="/calculator">calorie calculator</a> or browse the <a href="/nutrition">recipes</a>.</p></div>`);
    return;
  }
  setHTML(list, shown.length ? shown.map(transformationCard) : html`<div class="empty" style="grid-column:1/-1"><h3>No stories in this category yet</h3><p>Try another filter.</p></div>`);
}

$$('[data-cat]').forEach((b) => b.addEventListener('click', () => {
  cat = b.dataset.cat;
  const u = new URL(location.href);
  if (cat) u.searchParams.set('goal', cat); else u.searchParams.delete('goal');
  history.replaceState(null, '', u);
  render();
}));

try {
  items = await select('transformations', 'select=slug,client_display_name,goal_category,duration_weeks,start_weight_kg,end_weight_kg,headline,before_image_url,after_image_url&status=eq.published&order=sort_order.asc,published_at.desc');
} catch (err) {
  items = null;
  setHTML(list, html`<div class="notice danger" style="grid-column:1/-1">Could not load transformations. ${err.message}</div>`);
}
if (Array.isArray(items)) render();
