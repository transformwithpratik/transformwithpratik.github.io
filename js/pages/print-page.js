// Static content pages (guides, recipe book): shared site behaviour plus "Save as PDF".
import { $$ } from '../lib/util.js';
import { initSite } from '../lib/site.js';

initSite();
$$('[data-print]').forEach((b) => b.addEventListener('click', () => window.print()));
$$('[data-checklist] input[type="checkbox"]').forEach((cb, i) => {
  const key = `gfp-check-${location.pathname}-${i}`;
  try { cb.checked = localStorage.getItem(key) === '1'; } catch { /* ignore */ }
  cb.addEventListener('change', () => { try { localStorage.setItem(key, cb.checked ? '1' : '0'); } catch { /* ignore */ } });
});
