import { $, html, setHTML } from '../lib/util.js';
import { initSite } from '../lib/site.js';
import { select, rpc } from '../lib/rest.js';
import { transformationCard, reviewCard, planCards, faqList, coachStory, coachPhoto } from '../lib/render.js';

const settings = await initSite();
const coach = settings.coach || {};

setHTML($('[data-coach-name]'), html`${coach.name || 'Pratik Jain'}`);
setHTML($('[data-coach-title]'), html`${coach.title || ''}`);
setHTML($('[data-coach-story]'), coach.story?.length ? coachStory(coach) : html`<p>Coaching built for busy professionals who want sustainable, measurable progress.</p>`);
setHTML($('[data-coach-credentials]'), (coach.credentials || []).map((c) => html`<span class="tag tag-dark">${c}</span>`));
const photo = coachPhoto(coach);
if (photo) {
  const fig = $('[data-coach-photo]');
  setHTML(fig, photo);
  fig.hidden = false;
  $('[data-coach-wrap]').classList.add('split');
  const side = $('[data-hero-side]');
  setHTML(side, html`<figure class="hero-photo" style="margin:0">${photo}<figcaption>${coach.name || 'Pratik Jain'} · ${coach.title || ''}</figcaption></figure>`);
}
setHTML($('[data-plans]'), planCards(settings.plans));
setHTML($('[data-faq]'), faqList(settings.faq));

const [tfs, reviews] = await Promise.allSettled([
  select('transformations', 'select=slug,client_display_name,goal_category,duration_weeks,start_weight_kg,end_weight_kg,headline,before_image_url,after_image_url&status=eq.published&order=sort_order.asc,published_at.desc&limit=3'),
  rpc('get_public_reviews', { p_limit: 3 }),
]);
if (tfs.status === 'fulfilled' && tfs.value?.length) {
  setHTML($('[data-results-list]'), tfs.value.map(transformationCard));
  $('[data-results]').hidden = false;
}
if (reviews.status === 'fulfilled' && reviews.value?.length) {
  setHTML($('[data-reviews-list]'), reviews.value.map(reviewCard));
  $('[data-reviews]').hidden = false;
}
