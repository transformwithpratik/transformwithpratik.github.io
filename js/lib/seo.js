// Updates title, description, canonical and social tags on pages rendered from data
// (recipe and transformation detail pages). Search engines that run JavaScript pick these up.
const SITE = 'https://transformwithpratik.github.io';

function meta(attr, key, value) {
  if (!value) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', value);
}

export function setPageMeta({ title, description, path, image, jsonLd }) {
  if (title) document.title = title;
  meta('name', 'description', description);
  meta('property', 'og:title', title);
  meta('property', 'og:description', description);
  meta('name', 'twitter:title', title);
  meta('name', 'twitter:description', description);
  if (image) { meta('property', 'og:image', image); meta('name', 'twitter:image', image); }
  if (path) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    const url = SITE + path + (path.endsWith('/') || path.includes('?') ? '' : '/');
    link.href = url;
    meta('property', 'og:url', url);
    const robots = document.head.querySelector('meta[name="robots"]');
    if (robots) robots.remove();
  }
  if (jsonLd) {
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(s);
  }
}

// Slug from /section/<slug> or ?slug=<slug>
export function slugFromLocation(section) {
  const q = new URLSearchParams(location.search).get('slug');
  if (q) return q;
  const m = location.pathname.match(new RegExp(`/${section}/([a-z0-9-]+)/?$`));
  return m ? m[1] : '';
}
