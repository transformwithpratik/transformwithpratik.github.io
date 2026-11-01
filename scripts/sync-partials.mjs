// Keeps shared markup identical across the static pages (no build step needed to serve the site).
//   node scripts/sync-partials.mjs
// Replaces the blocks between these markers in every .html file:
//   <!-- @head --> ... <!-- /@head -->       charset, viewport, canonical, Open Graph, icons, fonts, CSS
//   <!-- @header --> ... <!-- /@header -->   public site header (partials/header.html)
//   <!-- @footer --> ... <!-- /@footer -->   public site footer (partials/footer.html)
// Each page keeps its own <title> and <meta name="description">; canonical and social tags are
// derived from those and from the file path. Portal and admin pages get noindex.
// Also writes sitemap.xml for every public page plus each recipe.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const cfg = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));
const SITE = cfg.siteUrl.replace(/\/$/, '');
const V = cfg.assetVersion;
const header = readFileSync(join(root, 'partials', 'header.html'), 'utf8').trim();
const footer = readFileSync(join(root, 'partials', 'footer.html'), 'utf8').trim();
const SKIP = new Set(['.git', 'node_modules', 'apps', '.claude', 'partials', 'scripts', 'supabase', 'docs', 'tests']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const pageUrl = (rel) => {
  let u = '/' + rel.split(sep).join('/');
  u = u.replace(/index\.html$/, '').replace(/\.html$/, '');
  if (u.length > 1) u = u.replace(/\/$/, '');
  return u;
};

function headBlock(html, rel) {
  const url = pageUrl(rel);
  const isApp = /^\/(portal|admin)(\/|$)/.test(url);
  const isStub = /http-equiv="refresh"/.test(html);
  const isNoindex = /name="x-noindex"/.test(html);
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'GetFitWithPratik';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const image = (html.match(/<meta name="x-og-image" content="([^"]*)"/) || [])[1] || '/assets/og-default.png';
  const lines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta name="theme-color" content="#171A18">',
  ];
  if (isApp || isStub || isNoindex || url === '/404') lines.push('<meta name="robots" content="noindex">');
  if (!isApp && !isStub && !isNoindex && url !== '/404') {
    lines.push(
      `<link rel="canonical" href="${SITE}${url === '/' ? '/' : url}">`,
      '<meta property="og:site_name" content="GetFitWithPratik">',
      '<meta property="og:type" content="website">',
      '<meta property="og:locale" content="en_IN">',
      `<meta property="og:url" content="${SITE}${url === '/' ? '/' : url}">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(desc)}">`,
      `<meta property="og:image" content="${SITE}${image}">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${esc(title)}">`,
      `<meta name="twitter:description" content="${esc(desc)}">`,
      `<meta name="twitter:image" content="${SITE}${image}">`,
    );
  }
  lines.push(
    '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">',
    '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap">',
    `<link rel="stylesheet" href="/css/site.css?v=${V}">`,
  );
  if (isApp) lines.push(`<link rel="stylesheet" href="/css/app.css?v=${V}">`);
  return { block: lines.join('\n'), url, isApp, isStub };
}

const replaceBlock = (html, name, content) => {
  const re = new RegExp(`<!-- @${name} -->[\\s\\S]*?<!-- /@${name} -->`);
  return re.test(html) ? html.replace(re, `<!-- @${name} -->\n${content}\n<!-- /@${name} -->`) : html;
};

const pages = walk(root);
const sitemap = [];
let changed = 0;
for (const file of pages) {
  const rel = relative(root, file);
  let html = readFileSync(file, 'utf8');
  const before = html;
  const { block, url, isApp, isStub } = headBlock(html, rel);
  html = replaceBlock(html, 'head', block);
  html = replaceBlock(html, 'header', header);
  html = replaceBlock(html, 'footer', footer);
  html = html.replace(/(\/js\/[\w/.-]+\.js)\?v=\d+/g, `$1?v=${V}`);
  if (html !== before) { writeFileSync(file, html); changed++; }
  if (!isApp && !isStub && url !== '/404' && !/x-noindex/.test(html)) sitemap.push(url);
}

const recipeSlugs = JSON.parse(readFileSync(join(root, 'scripts', 'content', 'recipe-slugs.json'), 'utf8'));
for (const s of recipeSlugs) sitemap.push(`/nutrition/recipes/${s}`);
const today = new Date().toISOString().slice(0, 10);
const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
  .concat([...new Set(sitemap)].sort().map((u) => `  <url><loc>${SITE}${u === '/' ? '/' : u}</loc><lastmod>${today}</lastmod></url>`))
  .concat(['</urlset>', '']).join('\n');
writeFileSync(join(root, 'sitemap.xml'), xml);
writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /portal/\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`synced ${changed} of ${pages.length} pages; sitemap has ${new Set(sitemap).size} URLs`);
