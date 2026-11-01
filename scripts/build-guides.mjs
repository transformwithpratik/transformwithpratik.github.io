// Builds the static guide pages and the library index from scripts/content/guides.mjs.
//   node scripts/build-guides.mjs && node scripts/sync-partials.mjs
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIDES } from './content/guides.mjs';
import { esc } from '../js/lib/util.js';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const cfg = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));
const SITE = cfg.siteUrl.replace(/\/$/, '');
const words = (s) => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

const shell = ({ title, description, body, jsonLd }) => `<!doctype html>
<html lang="en-IN">
<head>
<!-- @head -->
<!-- /@head -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n` : ''}</head>
<body>
<!-- @header -->
<!-- /@header -->

<main id="main">
${body}
</main>

<!-- @footer -->
<!-- /@footer -->
<script type="module" src="/js/pages/print-page.js?v=${cfg.assetVersion}"></script>
</body>
</html>
`;

for (const g of GUIDES) {
  const mins = Math.max(2, Math.round(words(g.body) / 220));
  const body = `  <article class="container" style="padding-block:clamp(32px,6vw,72px) 96px">
    <p class="crumbs"><a href="/library">Library</a> / ${esc(g.category)}</p>
    <h1 style="font-size:var(--t-h2);max-width:20ch">${esc(g.title)}</h1>
    <p class="small muted">${mins} min read · By Pratik Jain</p>
    <p class="no-print"><button class="btn btn-ghost btn-sm" type="button" data-print>Save as PDF</button></p>
    <div class="prose" style="margin-top:28px">
${g.body.trim()}
    </div>
    ${g.sources.length ? `<div class="sources prose"><p><b>Sources</b></p><ol>${g.sources.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}
    <p class="small muted prose" style="margin-top:24px">General information, not medical advice. If you have a health condition, are pregnant or take medication, check with your doctor before changing your diet, training or supplements.</p>
    <div class="cta-band no-print" style="margin-top:48px">
      <div><h2>Want this applied to your week?</h2><p>Coaching turns these basics into a plan for your schedule, food and goal, with a weekly check-in.</p></div>
      <a class="btn" href="/book">Start your transformation</a>
    </div>
  </article>`;
  mkdirSync(join(root, 'library', g.slug), { recursive: true });
  writeFileSync(join(root, 'library', g.slug, 'index.html'), shell({
    title: `${g.title} | GetFitWithPratik`,
    description: g.description,
    body,
    jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, author: { '@type': 'Person', name: 'Pratik Jain' }, publisher: { '@type': 'Organization', name: 'GetFitWithPratik' }, mainEntityOfPage: `${SITE}/library/${g.slug}` },
  }));
}

const cards = [
  { href: '/nutrition/recipe-book', tag: 'Download', title: 'Vegetarian high-protein recipe book', desc: 'Every recipe on printable pages.' },
  ...GUIDES.map((g) => ({ href: `/library/${g.slug}`, tag: g.checklist ? 'Download' : g.category, title: g.title, desc: g.description })),
  { href: '/workouts', tag: 'Training', title: 'Exercise library', desc: 'Form, cues, mistakes and swaps for the main lifts.' },
  { href: '/calculator', tag: 'Tool', title: 'Calculators', desc: 'Calories and macros, protein, BMI, waist-to-height and water.' },
];
const index = `  <header class="page-head container">
    <h1>Library</h1>
    <p class="lead">Practical guides for busy professionals on food, training, sleep, supplements, office days and travel. Free to read and save as a PDF.</p>
  </header>
  <section class="container" style="padding-bottom:64px" aria-label="Guides">
    <div class="lib-grid">
${cards.map((c) => `      <a class="card card-link lib-card" href="${c.href}"><span class="tag ${c.tag === 'Download' ? 'tag-lime' : ''}">${esc(c.tag)}</span><h2 style="font-size:1.2rem;margin:0">${esc(c.title)}</h2><p class="muted small" style="margin:0">${esc(c.desc)}</p></a>`).join('\n')}
    </div>
    <div class="notice" style="margin-top:32px"><span>Coaching clients also get client-only downloads in their portal library.</span></div>
  </section>`;
mkdirSync(join(root, 'library'), { recursive: true });
writeFileSync(join(root, 'library', 'index.html'), shell({
  title: 'Library: fitness and nutrition guides | GetFitWithPratik',
  description: 'Free, research-backed guides on nutrition, office snacks, eating out, supplements, sleep, office fitness and travel workouts for busy professionals.',
  body: index,
}));
console.log(`Wrote ${GUIDES.length} guides and the library index`);
