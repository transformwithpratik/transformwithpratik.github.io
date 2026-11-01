import { $, html, setHTML, label, fmtNum, fmtDate } from '../lib/util.js';
import { initSite } from '../lib/site.js';
import { select, publicFileUrl } from '../lib/rest.js';
import { setPageMeta, slugFromLocation } from '../lib/seo.js';

initSite();
const box = $('[data-story]');
const slug = slugFromLocation('transformations');

function notFound() {
  setHTML(box, html`<p class="crumbs"><a href="/transformations">Transformations</a></p><div class="empty"><h1>This story is not available</h1><p>It may have been removed at the client's request. <a href="/transformations">See all transformations</a>.</p></div>`);
}

if (!slug || slug === 'story') notFound();
else {
  try {
    const rows = await select('transformations', `select=*&status=eq.published&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    const t = rows?.[0];
    if (!t) notFound();
    else render(t);
  } catch (err) {
    setHTML(box, html`<div class="notice danger">Could not load this story. ${err.message}</div>`);
  }
}

function render(t) {
  const before = publicFileUrl('transformations', t.before_image_url);
  const after = publicFileUrl('transformations', t.after_image_url);
  const change = t.start_weight_kg && t.end_weight_kg ? Math.round((t.end_weight_kg - t.start_weight_kg) * 10) / 10 : null;
  const title = `${t.headline || `${t.client_display_name}'s transformation`} | GetFitWithPratik`;
  setPageMeta({ title, description: (t.summary || t.goal || '').slice(0, 155), path: `/transformations/story/?slug=${encodeURIComponent(t.slug)}`, image: after || before });
  setHTML(box, html`
    <p class="crumbs"><a href="/transformations">Transformations</a> / ${t.client_display_name}</p>
    <span class="tag">${label('tf', t.goal_category)}</span>
    <h1 style="font-size:var(--t-h2);margin-top:12px;max-width:22ch">${t.headline || `${t.client_display_name}'s transformation`}</h1>
    <div class="split even" style="margin-top:28px">
      <div class="tf-pics" style="border-radius:var(--r-xl);overflow:hidden">
        <figure>${before ? html`<img src="${before}" alt="${t.client_display_name} before">` : ''}<figcaption>Before</figcaption></figure>
        <figure>${after ? html`<img src="${after}" alt="${t.client_display_name} after">` : ''}<figcaption>After</figcaption></figure>
      </div>
      <div class="stack" style="--stack:20px">
        <div class="nutri" style="grid-template-columns:repeat(3,1fr)">
          <div><b>${t.duration_weeks || '-'}</b><span>weeks</span></div>
          <div><b>${t.start_weight_kg ? fmtNum(t.start_weight_kg, 1) : '-'}</b><span>start kg</span></div>
          <div><b>${t.end_weight_kg ? fmtNum(t.end_weight_kg, 1) : '-'}</b><span>end kg${change != null ? ` (${change > 0 ? '+' : ''}${fmtNum(change, 1)})` : ''}</span></div>
        </div>
        ${t.goal ? html`<div><h2 style="font-size:1.25rem">The goal</h2><p>${t.goal}</p></div>` : ''}
        ${t.summary ? html`<div class="prose"><h2 style="font-size:1.25rem;margin-top:0">What we did</h2>${t.summary.split(/\n{2,}/).map((p) => html`<p>${p}</p>`)}</div>` : ''}
        ${t.testimonial ? html`<figure class="card quote"><blockquote>${t.testimonial}</blockquote><figcaption>${t.client_display_name}</figcaption></figure>` : ''}
        <p class="small muted">Published ${fmtDate(t.published_at)} with ${t.client_display_name}'s permission. Individual results vary with starting point, consistency and health.</p>
        <p><a class="btn btn-primary" href="/book">Start your transformation</a></p>
      </div>
    </div>`);
}
