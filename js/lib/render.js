// Shared renderers for public content blocks.
import { html, raw, label, fmtNum, safeUrl, esc } from './util.js';
import { publicFileUrl } from './rest.js';

export function transformationCard(t) {
  const before = publicFileUrl('transformations', t.before_image_url);
  const after = publicFileUrl('transformations', t.after_image_url);
  const change = t.start_weight_kg && t.end_weight_kg ? Math.round((t.end_weight_kg - t.start_weight_kg) * 10) / 10 : null;
  return html`<a class="tf-card" href="/transformations/${t.slug}">
    ${before || after ? html`<div class="tf-pics">
      <figure>${before ? html`<img src="${before}" alt="${t.client_display_name} before" loading="lazy">` : ''}<figcaption>Before</figcaption></figure>
      <figure>${after ? html`<img src="${after}" alt="${t.client_display_name} after" loading="lazy">` : ''}<figcaption>After</figcaption></figure>
    </div>` : ''}
    <div class="tf-body">
      <span class="tag">${label('tf', t.goal_category)}</span>
      <h3 style="font-size:1.2rem;margin:0">${t.headline || t.client_display_name}</h3>
      <p class="muted small" style="margin:0">${t.client_display_name}</p>
      <div class="tf-stats">
        ${t.duration_weeks ? html`<span><b>${t.duration_weeks}</b>weeks</span>` : ''}
        ${change != null ? html`<span><b>${change > 0 ? '+' : ''}${fmtNum(change, 1)} kg</b>weight change</span>` : ''}
      </div>
    </div>
  </a>`;
}

export function reviewCard(r) {
  const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
  return html`<figure class="card quote">
    <span class="stars" aria-label="${r.rating} out of 5">${stars}</span>
    <blockquote>${r.body}</blockquote>
    <figcaption>${r.display_name}${r.relationship ? html` · ${label('relationship', r.relationship)}` : ''}</figcaption>
  </figure>`;
}

export function planCards(plans) {
  if (!plans?.length) return html`<div class="empty"><h3>Plans are being updated</h3><p>Tell me about your goal and I will suggest the right length on our call.</p><p><a class="btn btn-primary btn-sm" href="/book">Start your transformation</a></p></div>`;
  return plans.map((p) => html`<article class="plan ${p.highlight ? 'highlight' : ''}">
    ${p.highlight ? html`<span class="tag tag-lime" style="align-self:flex-start">Most chosen</span>` : ''}
    <h3>${p.name}</h3>
    <div class="price">${p.price ? p.price : html`<span style="font-size:1.05rem">Price on your consult call</span>`}${p.duration ? html` <small>· ${p.duration}</small>` : ''}</div>
    ${p.summary ? html`<p class="muted" style="margin:0">${p.summary}</p>` : ''}
    <ul>${(p.features || []).map((f) => html`<li>${f}</li>`)}</ul>
    <a class="btn ${p.highlight ? 'btn-primary' : 'btn-ghost'}" href="/book?plan=${encodeURIComponent(p.name)}">Choose ${p.name}</a>
  </article>`);
}

export function faqList(items) {
  return (items || []).map((f) => html`<details><summary>${f.q}</summary><div><p>${f.a}</p></div></details>`);
}

export function coachStory(coach) {
  return (coach.story || []).map((p) => html`<p>${p}</p>`);
}

export function coachPhoto(coach) {
  const src = safeUrl(coach.photo_url);
  if (!src) return '';
  return html`<img src="${src}" alt="${coach.name || 'Pratik'}" loading="lazy">`;
}

// Generated artwork for recipes without a photo: two tones plus the protein number.
const ART = [['#B8F36B', '#55622B'], ['#E9E2C7', '#171A18'], ['#DCE6C3', '#3D4A1F'], ['#F2D9B8', '#5E3E15'], ['#CFE3D9', '#1F4A3A']];
export function recipeArt(r) {
  const img = safeUrl(r.image_url) || (r.image_url ? publicFileUrl('site-media', r.image_url) : '');
  if (img) return html`<img src="${img}" alt="${r.title}" loading="lazy">`;
  let h = 0; for (const c of r.slug || r.title || '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = ART[h % ART.length];
  const p = Math.round(r.protein_g || 0);
  return raw(`<svg viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" fill="${bg}"/><circle cx="${250 - (h % 60)}" cy="${60 + (h % 50)}" r="${70 + (h % 30)}" fill="${fg}" opacity="0.12"/><path d="M0 ${150 - (h % 20)} C 80 ${130 - (h % 25)}, 160 ${170 - (h % 30)}, 320 ${110 - (h % 20)}" stroke="${fg}" stroke-width="3" fill="none" opacity="0.5"/><text x="22" y="64" font-family="Archivo, sans-serif" font-weight="850" font-size="54" fill="${fg}" style="font-variation-settings:'wdth' 120">${esc(p)}g</text><text x="24" y="90" font-family="Archivo, sans-serif" font-weight="600" font-size="15" fill="${fg}">protein per serving</text></svg>`);
}

export function recipeCard(r) {
  return html`<a class="recipe-card" href="/nutrition/recipes/${r.slug}">
    <div class="recipe-art">${recipeArt(r)}</div>
    <div class="recipe-body">
      <h3>${r.title}</h3>
      <div class="cluster" style="--gap:6px">${(r.diet_tags || []).slice(0, 2).map((t) => html`<span class="tag">${label('diet', t)}</span>`)}</div>
      <div class="recipe-meta"><span><b>${fmtNum(r.calories)}</b> kcal</span><span><b>${fmtNum(r.protein_g)} g</b> protein</span><span>${(r.prep_minutes || 0) + (r.cook_minutes || 0)} min</span></div>
    </div>
  </a>`;
}

const DIET_SCHEMA = { vegetarian: 'https://schema.org/VegetarianDiet', vegan: 'https://schema.org/VeganDiet', gluten_free: 'https://schema.org/GlutenFreeDiet' };

export function recipeJsonLd(r, siteUrl = 'https://transformwithpratik.github.io') {
  const iso = (m) => (m ? `PT${m}M` : undefined);
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.title,
    description: r.summary,
    url: `${siteUrl}/nutrition/recipes/${r.slug}`,
    author: { '@type': 'Person', name: 'Pratik Jain' },
    recipeYield: `${r.servings} serving${r.servings > 1 ? 's' : ''}`,
    prepTime: iso(r.prep_minutes),
    cookTime: iso(r.cook_minutes),
    totalTime: iso((r.prep_minutes || 0) + (r.cook_minutes || 0)),
    recipeCategory: (r.categories || []).map((c) => label('category', c)).join(', '),
    recipeCuisine: 'Indian',
    suitableForDiet: (r.diet_tags || []).map((d) => DIET_SCHEMA[d]).filter(Boolean),
    nutrition: {
      '@type': 'NutritionInformation',
      calories: `${r.calories} calories`,
      proteinContent: `${r.protein_g} g`,
      carbohydrateContent: `${r.carbs_g} g`,
      fatContent: `${r.fat_g} g`,
      servingSize: '1 serving',
    },
    recipeIngredient: (r.ingredients || []).map((i) => i.item),
    recipeInstructions: (r.steps || []).map((s) => ({ '@type': 'HowToStep', text: s })),
  };
}

export function recipeDetail(r, related = []) {
  return html`
  <p class="crumbs"><a href="/nutrition">Nutrition hub</a> / <a href="/nutrition#recipes">Recipes</a></p>
  <div class="recipe-hero">
    <div class="recipe-art">${recipeArt(r)}</div>
    <div>
      <div class="cluster" style="--gap:6px">${(r.diet_tags || []).map((t) => html`<span class="tag">${label('diet', t)}</span>`)}${(r.categories || []).slice(0, 3).map((c) => html`<a class="tag tag-dark" href="/nutrition?cat=${c}#recipes">${label('category', c)}</a>`)}</div>
      <h1 style="font-size:var(--t-h2);margin-top:14px">${r.title}</h1>
      <p class="lead muted">${r.summary}</p>
      <div class="nutri" style="margin-top:20px">
        <div><b>${fmtNum(r.calories)}</b><span>kcal</span></div>
        <div><b>${fmtNum(r.protein_g)} g</b><span>protein</span></div>
        <div><b>${fmtNum(r.carbs_g)} g</b><span>carbs</span></div>
        <div><b>${fmtNum(r.fat_g)} g</b><span>fat</span></div>
      </div>
      <p class="small muted" style="margin-top:10px">Per serving. Serves ${r.servings}. Prep ${r.prep_minutes || 0} min${r.cook_minutes ? html`, cook ${r.cook_minutes} min` : ''}.</p>
      <div class="cluster no-print" style="margin-top:18px" data-recipe-actions>
        <button class="btn btn-ghost btn-sm" type="button" data-print>Save as PDF</button>
        <button class="btn btn-ghost btn-sm" type="button" data-share>Share</button>
        <button class="btn btn-ghost btn-sm fav-btn" type="button" data-fav aria-pressed="false">Save to favourites</button>
      </div>
    </div>
  </div>
  <div class="split" style="margin-top:56px">
    <section aria-labelledby="ing-title">
      <h2 id="ing-title" style="font-size:1.5rem">Ingredients</h2>
      <ul class="ing-list">${(r.ingredients || []).map((i) => html`<li>${i.item}</li>`)}</ul>
    </section>
    <section aria-labelledby="method-title">
      <h2 id="method-title" style="font-size:1.5rem">Method</h2>
      <ol class="method">${(r.steps || []).map((s) => html`<li>${s}</li>`)}</ol>
      ${r.tips ? html`<div class="notice ok" style="margin-top:20px"><span><b>Tip.</b> ${r.tips}</span></div>` : ''}
    </section>
  </div>
  <p class="small muted" style="margin-top:40px;max-width:72ch">Nutrition is estimated from standard food-composition values (USDA FoodData Central, IFCT 2017 and typical pack labels), with spices counted as zero. Brands and portion sizes vary, so treat the numbers as close estimates.</p>
  ${related.length ? html`<section class="no-print" style="margin-top:64px"><h2 style="font-size:1.5rem">More like this</h2><div class="recipe-grid">${related.map(recipeCard)}</div></section>` : ''}
  `;
}
