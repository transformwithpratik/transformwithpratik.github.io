// Minimal SVG charts for the portal and admin (no library).
// lineChart: weight and strength trends. barChart: daily totals against a target.
import { esc, fmtDate, fmtNum } from './util.js';

const W = 640; const H = 240; const P = { t: 16, r: 16, b: 32, l: 44 };

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

function emptyState(el, text) {
  el.innerHTML = `<div class="chart-empty">${esc(text)}</div>`;
}

// series: [{ name, points: [{x: 'YYYY-MM-DD', y: number}], className }]
export function lineChart(el, series, { unit = '', emptyText = 'No data yet.', label = 'Trend chart', goal = null } = {}) {
  const all = series.flatMap((s) => s.points).filter((p) => p.y != null && !Number.isNaN(p.y));
  if (all.length === 0) return emptyState(el, emptyText);
  const xs = [...new Set(all.map((p) => p.x))].sort();
  const t0 = new Date(xs[0]).getTime(); const t1 = new Date(xs[xs.length - 1]).getTime();
  const ys = all.map((p) => p.y).concat(goal != null ? [goal] : []);
  const { lo, hi, ticks } = niceTicks(Math.min(...ys), Math.max(...ys));
  const sx = (x) => (t1 === t0 ? (P.l + W - P.r) / 2 : P.l + ((new Date(x).getTime() - t0) / (t1 - t0)) * (W - P.l - P.r));
  const sy = (y) => P.t + (1 - (y - lo) / (hi - lo || 1)) * (H - P.t - P.b);

  const grid = ticks.map((v) => `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${sy(v)}" y2="${sy(v)}"/><text class="tick" x="${P.l - 8}" y="${sy(v) + 4}" text-anchor="end">${fmtNum(v, 1)}</text>`).join('');
  const xl = xs.length <= 1 ? [xs[0]] : [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]];
  const xlab = [...new Set(xl)].map((x) => `<text class="tick" x="${sx(x)}" y="${H - 8}" text-anchor="middle">${esc(fmtDate(x, { day: 'numeric', month: 'short' }))}</text>`).join('');
  const goalLine = goal != null ? `<line class="goal" x1="${P.l}" x2="${W - P.r}" y1="${sy(goal)}" y2="${sy(goal)}"/><text class="goal-label" x="${W - P.r}" y="${sy(goal) - 6}" text-anchor="end">Target ${fmtNum(goal, 1)}${esc(unit)}</text>` : '';
  const paths = series.map((s, i) => {
    const pts = s.points.filter((p) => p.y != null).sort((a, b) => (a.x < b.x ? -1 : 1));
    if (!pts.length) return '';
    const d = pts.map((p, j) => `${j ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
    const dots = s.dots === false ? '' : pts.map((p) => `<circle class="dot" cx="${sx(p.x)}" cy="${sy(p.y)}" r="3.5"/>`).join('');
    return `<g class="series s${i} ${esc(s.className || '')}"><path d="${d}"/>${dots}</g>`;
  }).join('');
  const hits = xs.map((x) => {
    const vals = series.map((s) => ({ name: s.name, p: s.points.find((p) => p.x === x) })).filter((v) => v.p && v.p.y != null);
    const tip = `${fmtDate(x)}: ${vals.map((v) => `${v.name ? `${v.name} ` : ''}${fmtNum(v.p.y, 1)}${unit}`).join(', ')}`;
    return `<rect class="hit" x="${sx(x) - 8}" y="${P.t}" width="16" height="${H - P.t - P.b}" data-tip="${esc(tip)}" tabindex="-1"/>`;
  }).join('');
  const legend = series.length > 1 ? `<div class="chart-legend">${series.map((s, i) => `<span class="lg s${i}"><i></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  el.innerHTML = `${legend}<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" preserveAspectRatio="none">${grid}${goalLine}${paths}${xlab}${hits}</svg><div class="chart-tip" hidden></div></div>`;
  wireTips(el);
}

// bars: [{x: 'YYYY-MM-DD', y: number}]
export function barChart(el, bars, { target = null, unit = '', emptyText = 'No data yet.', label = 'Bar chart' } = {}) {
  if (!bars.length || bars.every((b) => !b.y)) return emptyState(el, emptyText);
  const max = Math.max(...bars.map((b) => b.y || 0), target || 0);
  const { hi, ticks } = niceTicks(0, max);
  const n = bars.length;
  const bw = (W - P.l - P.r) / n;
  const sy = (y) => P.t + (1 - y / (hi || 1)) * (H - P.t - P.b);
  const grid = ticks.map((v) => `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${sy(v)}" y2="${sy(v)}"/><text class="tick" x="${P.l - 8}" y="${sy(v) + 4}" text-anchor="end">${fmtNum(v)}</text>`).join('');
  const rects = bars.map((b, i) => {
    const x = P.l + i * bw + bw * 0.18; const w = bw * 0.64; const y = sy(b.y || 0);
    const over = target && b.y > target * 1.1;
    const tip = `${fmtDate(b.x)}: ${fmtNum(b.y)}${unit}${target ? ` of ${fmtNum(target)}${unit}` : ''}`;
    return `<rect class="bar ${over ? 'over' : ''}" x="${x}" y="${y}" width="${w}" height="${Math.max(0, H - P.b - y)}" rx="3" data-tip="${esc(tip)}"/>`;
  }).join('');
  const every = Math.ceil(n / 7);
  const xlab = bars.map((b, i) => (i % every === 0 || i === n - 1 ? `<text class="tick" x="${P.l + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(fmtDate(b.x, { day: 'numeric', month: 'short' }))}</text>` : '')).join('');
  const tl = target ? `<line class="goal" x1="${P.l}" x2="${W - P.r}" y1="${sy(target)}" y2="${sy(target)}"/>` : '';
  el.innerHTML = `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" preserveAspectRatio="none">${grid}${rects}${tl}${xlab}</svg><div class="chart-tip" hidden></div></div>`;
  wireTips(el);
}

function wireTips(el) {
  const box = el.querySelector('.chart-box');
  const tip = el.querySelector('.chart-tip');
  if (!box || !tip) return;
  const show = (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip;
    tip.hidden = false;
    const r = box.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    const left = Math.min(Math.max(tr.left - r.left + tr.width / 2, 70), r.width - 70);
    tip.style.left = `${left}px`;
  };
  box.addEventListener('pointermove', show);
  box.addEventListener('pointerdown', show);
  box.addEventListener('pointerleave', () => { tip.hidden = true; });
}
