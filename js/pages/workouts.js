import { $, $$, html, setHTML, debounce, label, LABELS, youtubeEmbed } from '../lib/util.js';
import { initSite } from '../lib/site.js';
import { select } from '../lib/rest.js';

initSite();
const state = { q: '', group: new URLSearchParams(location.search).get('muscle') || '', eq: '', lvl: '' };
let items = [];

setHTML($('[data-groups]'), [html`<button class="chip" type="button" data-group="" aria-pressed="true">All</button>`,
  ...Object.entries(LABELS.muscle).map(([k, v]) => html`<button class="chip" type="button" data-group="${k}" aria-pressed="false">${v}</button>`)]);

function card(x) {
  const embed = youtubeEmbed(x.video_url);
  return html`<article class="card ex-card" id="${x.slug}">
    <div class="cluster" style="--gap:6px"><span class="tag tag-dark">${label('muscle', x.muscle_group)}</span><span class="tag">${label('equipment', x.equipment)}</span><span class="tag">${label('experience', x.level)}</span></div>
    <h3 style="margin:0">${x.name}</h3>
    <p class="muted small" style="margin:0">${x.summary}</p>
    ${embed ? html`<div class="video-wrap"><iframe src="${embed}" title="${x.name} demonstration" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>` : ''}
    <details>
      <summary>How to do it</summary>
      <ol>${(x.steps || []).map((s) => html`<li>${s}</li>`)}</ol>
      ${x.cues?.length ? html`<p class="small" style="margin:0 0 4px"><b>Cues</b></p><ul>${x.cues.map((c) => html`<li>${c}</li>`)}</ul>` : ''}
      ${x.mistakes?.length ? html`<p class="small" style="margin:0 0 4px"><b>Common mistakes</b></p><ul>${x.mistakes.map((c) => html`<li>${c}</li>`)}</ul>` : ''}
      ${x.substitutions?.length ? html`<p class="small" style="margin:0"><b>Swaps:</b> ${x.substitutions.join(', ')}</p>` : ''}
    </details>
  </article>`;
}

function render() {
  $$('[data-group]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.group === state.group)));
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = items.filter((x) => (!state.group || x.muscle_group === state.group)
    && (!state.eq || x.equipment === state.eq) && (!state.lvl || x.level === state.lvl)
    && words.every((w) => `${x.name} ${x.summary} ${(x.substitutions || []).join(' ')}`.toLowerCase().includes(w)));
  $('[data-count]').textContent = `Showing ${list.length} of ${items.length} exercises`;
  setHTML($('[data-list]'), list.length ? list.map(card) : html`<div class="empty" style="grid-column:1/-1"><h3>No exercises match</h3><p>Try a different filter.</p></div>`);
}

$('[data-groups]').addEventListener('click', (e) => { const b = e.target.closest('[data-group]'); if (b) { state.group = b.dataset.group; render(); } });
$('[data-q]').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); render(); }, 200));
$('[data-eq]').addEventListener('change', (e) => { state.eq = e.target.value; render(); });
$('[data-lvl]').addEventListener('change', (e) => { state.lvl = e.target.value; render(); });

try {
  items = await select('exercises', 'select=*&is_published=eq.true&order=muscle_group.asc,name.asc');
  render();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
} catch (err) {
  setHTML($('[data-list]'), html`<div class="notice danger" style="grid-column:1/-1">Could not load the exercise library. ${err.message}</div>`);
}
