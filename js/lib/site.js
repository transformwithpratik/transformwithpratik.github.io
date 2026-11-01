// Shared behaviour for public pages: header, mobile menu, current-page link,
// contact links from settings, and a "My portal" link when signed in.
import { $, $$, safeUrl, waLink } from './util.js';
import { getSettings } from './settings.js';
import { AUTH_STORAGE_KEY } from '../config.js';

function initHeader() {
  const header = $('[data-header]');
  if (!header) return;
  if (document.body.dataset.headerTheme === 'dark') header.classList.add('on-dark');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const menu = $('[data-menu]');
  const openBtn = $('[data-menu-open]');
  const closeBtn = $('[data-menu-close]');
  const open = () => { menu.hidden = false; openBtn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; closeBtn.focus(); };
  const close = () => { menu.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; openBtn.focus(); };
  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  menu?.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  $$('a', menu).forEach((a) => a.addEventListener('click', () => { menu.hidden = true; document.body.style.overflow = ''; }));

  const path = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1');
  $$('.nav-list a, .mobile-nav ul a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === path || (href !== '/' && path.startsWith(`${href}/`))) a.setAttribute('aria-current', 'page');
  });

  let signedIn = false;
  try { signedIn = !!JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null')?.access_token; } catch { /* ignore */ }
  if (signedIn) $$('[data-portal-link]').forEach((a) => { a.textContent = 'My portal'; a.href = '/portal/'; });
}

async function initContact() {
  const s = await getSettings();
  const c = s.contact || {};
  const links = {
    instagram: safeUrl(c.instagram),
    youtube: safeUrl(c.youtube),
    whatsapp: waLink(c.whatsapp, 'Hi Pratik, I found you through your website.'),
    email: c.email ? `mailto:${c.email}` : '',
  };
  $$('[data-contact]').forEach((a) => {
    const href = links[a.dataset.contact];
    if (href) { a.href = href; a.hidden = false; if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; } }
    else a.hidden = true;
  });
  $$('[data-contact-text="email"]').forEach((el) => { el.textContent = c.email || ''; });
  $$('[data-contact-text="instagram_handle"]').forEach((el) => { el.textContent = c.instagram_handle || ''; });
  $$('[data-contact-text="response_time"]').forEach((el) => { el.textContent = c.response_time || ''; });
  return s;
}

export function initSite() {
  initHeader();
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  return initContact();
}
