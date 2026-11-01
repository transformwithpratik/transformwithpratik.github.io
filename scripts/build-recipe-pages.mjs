// Pre-renders a static, indexable page for every recipe plus the printable recipe book.
//   node scripts/build-recipe-pages.mjs            (uses live recipes from Supabase when reachable)
//   node scripts/build-recipe-pages.mjs --offline  (uses scripts/content/recipes.mjs)
// Then run: node scripts/sync-partials.mjs
// The pages still refresh from the database in the browser, so admin edits show immediately;
// re-run this script after adding recipes so search engines see them too.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES } from './content/recipes.mjs';
import { macrosFor } from './content/ingredients.mjs';
import { recipeDetail, recipeJsonLd, recipeArt } from '../js/lib/render.js';
import { html, esc, fmtNum, label } from '../js/lib/util.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../js/config.js';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const cfg = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));
const SITE = cfg.siteUrl.replace(/\/$/, '');

async function loadRecipes() {
  if (!process.argv.includes('--offline')) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?select=*&is_published=eq.true&order=sort_order.asc,title.asc`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, signal: AbortSignal.timeout(8000),
      });
      if (res.ok) { const rows = await res.json(); if (rows.length) { console.log(`Loaded ${rows.length} recipes from Supabase`); return rows; } }
    } catch { /* fall back */ }
    console.log('Supabase not reachable; using local recipe source');
  }
  return RECIPES.map((r, i) => ({
    slug: r.slug, title: r.title, summary: r.summary, servings: r.servings, prep_minutes: r.prep, cook_minutes: r.cook,
    ...macrosFor(r.ingredients, r.servings), categories: r.categories, diet_tags: r.diet, tips: r.tips, sort_order: i,
    ingredients: r.ingredients.map((x) => ({ item: x.label, grams: x.g || null })), steps: r.steps, image_url: null,
  }));
}

const page = ({ title, description, body, script, jsonLd, extraHead = '' }) => `<!doctype html>
<html lang="en-IN">
<head>
<!-- @head -->
<!-- /@head -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${extraHead}${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n` : ''}</head>
<body>
<!-- @header -->
<!-- /@header -->

<main id="main">
${body}
</main>

<!-- @footer -->
<!-- /@footer -->
${script ? `<script type="module" src="${script}?v=${cfg.assetVersion}"></script>\n` : ''}</body>
</html>
`;

const recipes = await loadRecipes();
for (const r of recipes) {
  const cat = r.categories?.[0];
  const related = recipes.filter((x) => x.slug !== r.slug && cat && x.categories.includes(cat)).slice(0, 3);
  const dir = join(root, 'nutrition', 'recipes', r.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page({
    title: `${r.title}: ${Math.round(r.protein_g)} g protein recipe | GetFitWithPratik`,
    description: r.summary,
    jsonLd: recipeJsonLd(r, SITE),
    body: `  <article class="container" style="padding-block:clamp(28px,5vw,56px) 96px" data-recipe data-slug="${esc(r.slug)}" data-prerendered="1">\n${recipeDetail(r, related)}\n  </article>`,
    script: '/js/pages/recipe.js',
  }));
}

// Printable recipe book
const book = html`
  <header class="page-head container">
    <p class="crumbs"><a href="/nutrition">Nutrition hub</a></p>
    <h1>Vegetarian high-protein recipe book</h1>
    <p class="lead">${recipes.length} recipes with calories and protein per serving. Use <b>Save as PDF</b> to keep a copy on your phone or print it for the kitchen.</p>
    <p class="no-print"><button class="btn btn-primary" type="button" data-print>Save as PDF</button></p>
  </header>
  <div class="container" style="padding-bottom:96px">
    <div class="table-wrap" style="margin-bottom:40px">
      <table class="table">
        <thead><tr><th>Recipe</th><th class="num">kcal</th><th class="num">Protein</th><th class="num">Carbs</th><th class="num">Fat</th><th>Best for</th></tr></thead>
        <tbody>${recipes.map((r) => html`<tr><td><a href="#${r.slug}">${r.title}</a></td><td class="num">${fmtNum(r.calories)}</td><td class="num">${fmtNum(r.protein_g)} g</td><td class="num">${fmtNum(r.carbs_g)} g</td><td class="num">${fmtNum(r.fat_g)} g</td><td>${(r.categories || []).slice(0, 2).map((c) => label('category', c)).join(', ')}</td></tr>`)}</tbody>
      </table>
    </div>
    ${recipes.map((r, i) => html`<section class="card print-break" id="${r.slug}" style="margin-bottom:24px;${i === 0 ? '' : ''}">
      <div class="split" style="grid-template-columns:1fr;gap:16px">
        <div>
          <h2 style="font-size:1.5rem;margin-bottom:6px"><a href="/nutrition/recipes/${r.slug}" style="text-decoration:none">${r.title}</a></h2>
          <p class="muted" style="margin-bottom:10px">${r.summary}</p>
          <p class="small"><b>${fmtNum(r.calories)} kcal</b> · <b>${fmtNum(r.protein_g)} g protein</b> · ${fmtNum(r.carbs_g)} g carbs · ${fmtNum(r.fat_g)} g fat · serves ${r.servings} · ${(r.prep_minutes || 0) + (r.cook_minutes || 0)} min</p>
        </div>
        <div class="grid grid-2" style="--gap:20px">
          <div><h3 style="font-size:1.05rem">Ingredients</h3><ul>${(r.ingredients || []).map((x) => html`<li>${x.item}</li>`)}</ul></div>
          <div><h3 style="font-size:1.05rem">Method</h3><ol>${(r.steps || []).map((s) => html`<li>${s}</li>`)}</ol>${r.tips ? html`<p class="small"><b>Tip.</b> ${r.tips}</p>` : ''}</div>
        </div>
      </div>
    </section>`)}
    <p class="small muted">Nutrition is estimated from standard food-composition values (USDA FoodData Central, IFCT 2017 and typical pack labels). Brands and portions vary. From transformwithpratik.github.io.</p>
  </div>`;
mkdirSync(join(root, 'nutrition', 'recipe-book'), { recursive: true });
writeFileSync(join(root, 'nutrition', 'recipe-book', 'index.html'), page({
  title: 'Vegetarian high-protein recipe book (free PDF) | GetFitWithPratik',
  description: `${recipes.length} vegetarian high-protein Indian recipes with calories and macros per serving, on printable pages you can save as a PDF.`,
  body: String(book),
  script: '/js/pages/print-page.js',
}));
writeFileSync(join(root, 'scripts', 'content', 'recipe-slugs.json'), JSON.stringify(recipes.map((r) => r.slug), null, 1));
console.log(`Wrote ${recipes.length} recipe pages and the recipe book`);
void recipeArt;
