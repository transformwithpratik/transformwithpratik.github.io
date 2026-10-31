// 2D overlay: titles, labels, captions in house style (Inter Display, white + black outline, brand yellow)
'use strict';
const BRAND_Y = '#F8C83D';
function font(ctx, size, weight = 900) { ctx.font = `${weight === 900 ? '' : ''}${size}px ${weight === 900 ? 'IDBlack' : 'IDXB'}`; }
// parts: string with *yellow* markup
function parseParts(s) { const out = []; s.split(/(\*[^*]+\*)/).forEach(p => { if (!p) return; if (p[0] === '*') out.push({ t: p.slice(1, -1), c: BRAND_Y }); else out.push({ t: p, c: '#fff' }); }); return out; }
function measureParts(ctx, parts) { return parts.reduce((a, p) => a + ctx.measureText(p.t).width, 0); }
function drawRich(ctx, str, x, y, o = {}) {
  const size = o.size || 80; font(ctx, size, o.weight || 900);
  const parts = typeof str === 'string' ? parseParts(str) : str;
  const w = measureParts(ctx, parts);
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(x, y); if (o.scale != null) ctx.scale(o.scale, o.scale); if (o.rot) ctx.rotate(o.rot);
  let cx = o.align === 'left' ? 0 : o.align === 'right' ? -w : -w / 2;
  ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  // shadow pass
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = size * 0.28; ctx.shadowOffsetY = size * 0.07;
  ctx.lineWidth = size * (o.stroke ?? 0.17); ctx.strokeStyle = '#000';
  let xx = cx; for (const p of parts) { ctx.strokeText(p.t, xx, 0); xx += ctx.measureText(p.t).width; }
  ctx.shadowColor = 'transparent';
  xx = cx; for (const p of parts) { ctx.strokeText(p.t, xx, 0); ctx.fillStyle = o.fill || p.c; ctx.fillText(p.t, xx, 0); xx += ctx.measureText(p.t).width; }
  ctx.restore();
  return w;
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// pill label
function chip(ctx, text, x, y, o = {}) {
  const size = o.size || 40; font(ctx, size, o.weight || 800);
  const w = ctx.measureText(text).width + size * 1.1, h = size * 1.55;
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.translate(x, y); const sc = o.scale ?? 1; ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
  rrect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = o.bg || BRAND_Y; ctx.fill(); ctx.shadowColor = 'transparent';
  if (o.border) { ctx.lineWidth = 4; ctx.strokeStyle = o.border; ctx.stroke(); }
  ctx.fillStyle = o.fg || '#111'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(text, 0, size * 0.04);
  ctx.restore();
  return w;
}
// leader line label from 3D anchor
function pointer(ctx, ax, ay, bx, by, alpha = 1, col = '#fff') {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.beginPath(); ctx.arc(ax, ay, 9, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.restore();
}
function arrow(ctx, x, y, len, dir, col, alpha = 1, wdt = 26) { // dir: -1 up, 1 down
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (dir > 0) ctx.rotate(Math.PI);
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 16; ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-wdt / 2, len / 2); ctx.lineTo(-wdt / 2, -len / 2 + wdt * 1.6); ctx.lineTo(-wdt * 1.5, -len / 2 + wdt * 1.6); ctx.lineTo(0, -len / 2); ctx.lineTo(wdt * 1.5, -len / 2 + wdt * 1.6); ctx.lineTo(wdt / 2, -len / 2 + wdt * 1.6); ctx.lineTo(wdt / 2, len / 2); ctx.closePath();
  ctx.stroke(); ctx.fill(); ctx.restore();
}
function bolt(ctx, x, y, s, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = BRAND_Y; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.08; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0.15, -1); ctx.lineTo(-0.45, 0.12); ctx.lineTo(-0.02, 0.12); ctx.lineTo(-0.2, 1); ctx.lineTo(0.45, -0.18); ctx.lineTo(0.02, -0.18); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
}
function popIn(t, dur = 0.28) { return t <= 0 ? 0 : easeBack(t / dur); }
function fadeIO(t, a, b, fi = 0.15, fo = 0.15) { return clamp((t - a) / fi) * clamp((b - t) / fo); }

// ---------- captions ----------
// words: [{w, s, e, k}] (timeline secs). chunks built once.
function buildChunks(words) {
  const chunks = []; let cur = [];
  const flush = () => { if (cur.length) chunks.push(cur); cur = []; };
  words.forEach((wd, i) => {
    const prev = words[i - 1];
    const len = cur.reduce((a, x) => a + x.w.length + 1, 0) + wd.w.length;
    if (cur.length && (cur.length >= 3 || len > 17 || (prev && wd.s - prev.e > 0.22) || wd.brk)) flush();
    cur.push(wd);
    if (/[.?!,…]$/.test(wd.w) && !wd.nobrk) flush();
  });
  flush();
  chunks.forEach((c, i) => { c.s = c[0].s; c.e = Math.max(c[c.length - 1].e + 0.12, chunks[i + 1] ? Math.min(chunks[i + 1][0].s, c[c.length - 1].e + 0.6) : c[c.length - 1].e + 0.5); if (chunks[i + 1]) c.e = Math.min(c.e, chunks[i + 1][0].s); });
  return chunks;
}
function drawCaptions(ctx, chunks, T, y = 1250, hide) {
  const ch = chunks.find(c => T >= c.s && T < c.e); if (!ch || hide) return;
  const size = 84; font(ctx, size, 900);
  const words = ch.map(w => ({ ...w, txt: w.w.replace(/[,.]$/, '').toUpperCase() }));
  const sp = size * 0.28; const widths = words.map(w => ctx.measureText(w.txt).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  // wrap if too wide
  let lines = [[0, words.length]]; if (total > 940 && words.length > 1) { const m = Math.ceil(words.length / 2); lines = [[0, m], [m, words.length]]; }
  lines.forEach(([a, b], li) => {
    const lw = widths.slice(a, b).reduce((x, y2) => x + y2, 0) + sp * (b - a - 1);
    let x = 540 - lw / 2; const yy = y + (li - (lines.length - 1) / 2) * size * 1.12;
    for (let i = a; i < b; i++) {
      const w = words[i]; const age = T - w.s;
      if (age >= -0.02) {
        const sc = age < 0.16 ? 0.7 + 0.3 * easeBack(age / 0.16) : 1;
        drawRich(ctx, [{ t: w.txt, c: w.k ? BRAND_Y : '#fff' }], x + widths[i] / 2, yy, { size, scale: sc });
      }
      x += widths[i] + sp;
    }
  });
}
