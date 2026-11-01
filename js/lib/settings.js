// Site settings (contact details, coach bio, plans, FAQ) edited from the admin dashboard.
// Defaults keep the site readable if the database cannot be reached.
import { select } from './rest.js';

export const DEFAULT_SETTINGS = {
  contact: {
    email: 'transformwithpratik@gmail.com',
    whatsapp: '',
    instagram: 'https://www.instagram.com/transform.withpratik/',
    instagram_handle: '@transform.withpratik',
    youtube: '',
    city: 'Bengaluru',
    response_time: 'Replies within 24 hours',
  },
  coach: {
    name: 'Pratik Jain',
    title: 'Software engineer and certified fitness coach',
    photo_url: '',
    story: [],
    credentials: ['Certified fitness coach'],
    stats: [],
  },
  plans: [],
  faq: [],
};

const KEY = 'gfp-settings-v1';
let pending = null;

export function getSettings() {
  if (pending) return pending;
  pending = (async () => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.data;
    } catch { /* storage unavailable */ }
    try {
      const rows = await select('site_settings', 'select=key,value');
      const data = structuredClone(DEFAULT_SETTINGS);
      for (const r of rows || []) data[r.key] = Array.isArray(r.value) ? r.value : { ...(data[r.key] || {}), ...r.value };
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data })); } catch { /* ignore */ }
      return data;
    } catch {
      return structuredClone(DEFAULT_SETTINGS);
    }
  })();
  return pending;
}

export const clearSettingsCache = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };
