import { $, html, setHTML } from '../lib/util.js';
import { initSite } from '../lib/site.js';
import { coachStory, coachPhoto } from '../lib/render.js';

const s = await initSite();
const coach = s.coach || {};
setHTML($('[data-coach-name]'), html`${coach.name || 'Pratik Jain'}`);
setHTML($('[data-coach-title]'), html`${coach.title || ''}`);
setHTML($('[data-coach-story]'), coachStory(coach));
setHTML($('[data-coach-credentials]'), (coach.credentials || []).map((c) => html`<span class="tag tag-dark">${c}</span>`));
setHTML($('[data-coach-stats]'), (coach.stats || []).map((st) => html`<li><span>${st.label}</span><span>${st.value}</span></li>`));
const photo = coachPhoto(coach);
if (photo) setHTML($('[data-coach-photo]'), photo);
