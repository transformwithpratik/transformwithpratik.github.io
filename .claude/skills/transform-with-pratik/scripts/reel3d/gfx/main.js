'use strict';
const E = new Engine(document.getElementById('gl'));
const A = buildAssets(E);
const hudC = document.getElementById('hud'), hud = hudC.getContext('2d');
const capC = document.getElementById('cap'), cap = capC.getContext('2d');
window.ready = Promise.all([document.fonts.load('80px IDBlack'), document.fonts.load('80px IDXB')]);
function clearGL() { const gl = E.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
window.renderScene = (name, t, d, cues) => {
  E.tAlpha = 1; E.tDim = 1; E.tZoom = 1; hudC.style.opacity = 1;
  E.reset(); hud.clearRect(0, 0, W, H); cap.clearRect(0, 0, W, H);
  SCENES[name](E, A, t, d, cues || {}, hud);
};
const CHUNKS = typeof TL !== 'undefined' ? buildChunks(TL.caps) : [];
function nameTag(ctx, t) {
  const a = clamp((t - 0.45) / 0.25) * clamp((3.7 - t) / 0.25); if (a <= 0) return;
  const x = lerp(-420, 70, easeOut((t - 0.45) / 0.35)); const y = 1395;
  ctx.save(); ctx.globalAlpha = a;
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; rrect(ctx, x, y - 52, 560, 112, 22); ctx.fillStyle = 'rgba(12,12,14,0.86)'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = BRAND_Y; rrect(ctx, x, y - 52, 12, 112, 6); ctx.fill();
  font(ctx, 44, 900); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText('PRATIK JAIN', x + 34, y - 16);
  font(ctx, 29, 800); ctx.fillStyle = '#d8d8dc'; ctx.fillText('Software engineer · Fitness coach', x + 34, y + 28);
  ctx.restore();
}
function bookmark(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(14, -18); ctx.lineTo(14, 20); ctx.lineTo(0, 9); ctx.lineTo(-14, 20); ctx.closePath(); ctx.fillStyle = '#111'; ctx.fill(); ctx.restore(); }
function overlays(ctx, T) {
  const O = TL.ov; let hideCap = false;
  // hook
  if (T < O.hook[1]) {
    const t = T - O.hook[0];
    drawRich(ctx, '*1 SMALL HABIT*', 540, 290, { size: 116, scale: popIn(t - 0.02, 0.32) });
    drawRich(ctx, 'FOR BETTER *BLOOD SUGAR*', 540, 410, { size: 70, scale: popIn(t - 0.3, 0.3), alpha: t > 0.3 ? 1 : 0 });
    nameTag(ctx, t);
  }
  if (T >= O.why[0] && T < O.why[1]) {
    hideCap = true; const t = T - O.whyWord;
    if (t > -0.05) drawRich(ctx, '*WHY?*', 430, 820, { size: 270, scale: popIn(t + 0.05, 0.22), rot: -0.06, stroke: 0.12 });
  }
  if (T >= O.todo[0] && T < O.todo[1]) {
    const t = T - O.todo[0];
    drawRich(ctx, "HERE'S *WHAT TO DO*", 540, 300, { size: 86, scale: popIn(t - 0.04) });
    for (let i = 0; i < 3; i++) { const a = clamp(Math.sin((t * 3 - i * 0.35) * PI)); arrow(ctx, 540, 430 + i * 34, 60, 1, BRAND_Y, a * clamp(t / 0.2) * 0.9, 22); }
  }
  if (T >= O.move[0] && T < O.move[1]) {
    hideCap = true; const t = T - O.moveWord; const sh = t > 0.2 && t < 0.4 ? Math.sin(t * 120) * 6 : 0;
    if (t > -0.05) drawRich(ctx, 'JUST', 430 + sh, 700, { size: 170, scale: popIn(t + 0.05, 0.2) });
    if (t > 0.18) drawRich(ctx, '*MOVE!*', 430 + sh, 900, { size: 240, scale: popIn(t - 0.18, 0.2), rot: -0.04 });
  }
  if (T >= O.cta[0]) {
    hideCap = true; const t = T - O.cta[0];
    if (t > 0.1) { const w = chip(ctx, '    SAVE IT', 540, 300, { size: 64, scale: popIn(t - 0.1) }); bookmark(ctx, 540 - w / 2 + 52, 300, 1.25 * popIn(t - 0.1)); }
    if (t > 0.5) {
      drawRich(ctx, 'FOLLOW', 540, 420, { size: 60, scale: popIn(t - 0.5) });
      const full = '@transform.withpratik'; const n = Math.floor(clamp((t - 0.62) / 0.75) * full.length);
      const txt = full.slice(0, n) + ((t * 4) % 1 < 0.5 && n < full.length ? '|' : '');
      if (n > 0) drawRich(ctx, [{ t: txt, c: BRAND_Y }], 540, 505, { size: 70 });
    }
    if (t > 1.35) chip(ctx, 'COMMENT “WALK” FOR THE GUIDE', 540, 1390, { size: 40, bg: '#fff', scale: popIn(t - 1.35) });
  }
  return hideCap;
}
window.renderAt = (T) => {
  hud.clearRect(0, 0, W, H); cap.clearRect(0, 0, W, H);
  const g = TL.gfx.find(x => T >= x.start - 1e-6 && T < x.end - 1e-6);
  E.tAlpha = 1; E.tDim = 1; E.tZoom = 1; let hudA = 1;
  if (g) {
    const t = T - g.start, d = g.end - g.start;
    const prev = TL.gfx.find(x => Math.abs(x.end - g.start) < 0.02), next = TL.gfx.find(x => Math.abs(x.start - g.end) < 0.02);
    if (!prev) { const u = clamp(t / 0.17); E.tAlpha = u; E.tZoom = lerp(1.12, 1, easeOut(u)); hudA = u; }
    else { const u = clamp(t / 0.13); E.tDim = u; hudA = u; }
    if (next) { const u = clamp((d - t) / 0.1); E.tDim *= u; hudA *= u; }
    else { const u = clamp((d - t) / 0.1); E.tAlpha *= u; hudA *= u; }
    E.reset(); SCENES[g.scene](E, A, t, d, g.cues, hud);
  } else clearGL();
  hudC.style.opacity = hudA;
  const hideCap = overlays(cap, T);
  drawCaptions(cap, CHUNKS, T, 1250, hideCap);
};
